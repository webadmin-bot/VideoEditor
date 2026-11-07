import os
import shutil
import subprocess
import time
import threading
import glob
from pathlib import Path
from typing import Dict, Any, Optional, Callable
import logging

from .enhancer import (
    build_enhancement_filter_string,
    check_realesrgan_available,
    load_realesrgan_upsampler
)
from .video_inspector import inspect_video_file
from .hardware import check_ffmpeg, test_encoder_initialization
from ..config import TEMP_DIR

logger = logging.getLogger("ai_video_studio.renderer")

def run_ffmpeg_with_progress(
    cmd: list,
    total_duration: float,
    codec_name: str,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    job_ref: Optional[Any] = None
):
    """
    Executes FFmpeg with asynchronous stderr consumption to completely prevent pipe deadlocks,
    while reading real progress metrics from stdout.
    """
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    if job_ref and hasattr(job_ref, "set_process"):
        job_ref.set_process(proc)

    stderr_lines = []
    def drain_stderr(pipe):
        try:
            for line in iter(pipe.readline, ''):
                if line:
                    stderr_lines.append(line)
        except Exception:
            pass
        finally:
            try:
                pipe.close()
            except Exception:
                pass

    stderr_thread = threading.Thread(target=drain_stderr, args=(proc.stderr,), daemon=True)
    stderr_thread.start()

    last_reported_pct = -1.0
    try:
        while True:
            if job_ref and getattr(job_ref, "cancelled", False):
                try:
                    proc.terminate()
                    time.sleep(0.1)
                    if proc.poll() is None:
                        proc.kill()
                except Exception:
                    pass
                raise RuntimeError("Rendering cancelled by user.")

            line = proc.stdout.readline() if proc.stdout else ""
            if not line and proc.poll() is not None:
                break

            line = line.strip()
            if line.startswith("out_time_us="):
                try:
                    us_val = int(line.split("=")[1])
                    cur_secs = us_val / 1000000.0
                    pct = min(99.0, max(0.0, (cur_secs / max(0.1, total_duration)) * 100.0))
                    if round(pct, 1) != last_reported_pct:
                        last_reported_pct = round(pct, 1)
                        if progress_callback:
                            progress_callback({
                                "stage": "RENDERING",
                                "progress_percent": last_reported_pct,
                                "current_time_sec": round(cur_secs, 1),
                                "encoder": codec_name
                            })
                except (ValueError, IndexError):
                    pass
            elif line == "progress=end":
                break

        proc.wait()
        stderr_thread.join(timeout=2.0)

        if proc.returncode != 0:
            err_text = "".join(stderr_lines[-25:]).strip() or f"FFmpeg exited with code {proc.returncode}"
            raise RuntimeError(f"FFmpeg rendering failed: {err_text}")

    finally:
        if proc.poll() is None:
            try:
                proc.kill()
            except Exception:
                pass

def render_final_video(
    input_path: str,
    output_path: str,
    ass_path: str,
    enhancement: Dict[str, Any],
    export_settings: Dict[str, Any],
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    job_ref: Optional[Any] = None
) -> Dict[str, Any]:
    in_file = Path(input_path)
    if not in_file.exists():
        raise FileNotFoundError(f"Input video file not found for render: {input_path}")

    # Inspect input to determine duration and stream parameters
    input_meta = inspect_video_file(str(in_file.resolve()))
    total_duration = max(0.5, float(input_meta.get("duration_seconds", 1.0)))
    source_fps = float(input_meta.get("fps", 30.0))

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg executable is not available on system PATH.")

    requested_codec = export_settings.get("videoCodec", "auto")
    hw_info = check_ffmpeg()
    verified_encoders = hw_info.get("verified_encoders", [])

    if requested_codec == "auto":
        if "av1_nvenc" in verified_encoders:
            codec = "av1_nvenc"
        elif "hevc_nvenc" in verified_encoders:
            codec = "hevc_nvenc"
        elif "h264_nvenc" in verified_encoders:
            codec = "h264_nvenc"
        else:
            codec = "libx264"
    else:
        if "nvenc" in requested_codec:
            if requested_codec in verified_encoders or test_encoder_initialization(ffmpeg, requested_codec):
                codec = requested_codec
            else:
                codec = "libx264"
        else:
            codec = requested_codec

    crf = export_settings.get("qualityCrf", 20)
    audio_codec = export_settings.get("audioCodec", "copy")
    fps = export_settings.get("fps") or source_fps

    ai_model = enhancement.get("aiModel", "None")
    is_neural_upscale = ai_model and ai_model not in ["None", "none", ""]
    applied_ai_model = None

    out_file = Path(output_path)
    if out_file.exists():
        try:
            out_file.unlink()
        except Exception:
            pass

    # ----------------- BRANCH 1: REAL-ESRGAN FRAME-BY-FRAME AI UPSCALING -----------------
    if is_neural_upscale:
        realesr_status = check_realesrgan_available()
        if not realesr_status["available"]:
            raise RuntimeError(
                f"AI upscaling requested with model '{ai_model}', but Real-ESRGAN is unavailable: "
                f"{realesr_status.get('error')}. Please install model weights in storage/models/realesrgan/ "
                f"or set AI Engine Model to 'None (Conventional Lanczos)'."
            )

        applied_ai_model = ai_model
        tile_size = 512 if enhancement.get("tiledProcessing", True) else 0
        device = realesr_status["device"]

        logger.info(f"Starting neural frame-by-frame upscaling with {ai_model} (tile={tile_size}, device={device})")
        upsampler = load_realesrgan_upsampler(model_name=ai_model, tile_size=tile_size, device=device)

        session_id = f"render_{int(time.time())}_{os.getpid()}"
        frames_dir = TEMP_DIR / f"{session_id}_raw"
        upscaled_dir = TEMP_DIR / f"{session_id}_upscaled"
        temp_audio = TEMP_DIR / f"{session_id}_audio.aac"

        frames_dir.mkdir(parents=True, exist_ok=True)
        upscaled_dir.mkdir(parents=True, exist_ok=True)

        try:
            # 1. Extract audio track to preserve synchronization
            audio_extract_cmd = [
                ffmpeg, "-y",
                "-i", str(in_file.resolve()),
                "-vn",
                "-c:a", "copy",
                str(temp_audio)
            ]
            has_audio = (subprocess.run(audio_extract_cmd, capture_output=True).returncode == 0 and temp_audio.exists() and temp_audio.stat().st_size > 0)

            # 2. Extract video frames as lossless PNGs
            if progress_callback:
                progress_callback({"stage": "EXTRACTING_FRAMES", "progress_percent": 2.0, "current_time_sec": 0.0, "encoder": codec})

            frame_extract_cmd = [
                ffmpeg, "-y",
                "-i", str(in_file.resolve()),
                "-qscale:v", "2",
                str(frames_dir / "frame_%07d.png")
            ]
            ext_res = subprocess.run(frame_extract_cmd, capture_output=True, text=True)
            if ext_res.returncode != 0:
                raise RuntimeError(f"FFmpeg frame extraction failed: {ext_res.stderr.strip()[:200]}")

            frame_files = sorted(glob.glob(str(frames_dir / "frame_*.png")))
            total_frames = len(frame_files)
            if total_frames == 0:
                raise RuntimeError("No frames extracted from input video.")

            # 3. Process frames with RealESRGAN
            import cv2
            for idx, f_path in enumerate(frame_files, start=1):
                if job_ref and getattr(job_ref, "cancelled", False):
                    raise RuntimeError("Rendering cancelled by user during AI upscaling.")

                img = cv2.imread(f_path, cv2.IMREAD_COLOR)
                if img is None:
                    continue

                output, _ = upsampler.enhance(img, outscale=upsampler.scale)
                out_frame_path = upscaled_dir / Path(f_path).name
                cv2.imwrite(str(out_frame_path), output)

                if idx % 5 == 0 or idx == total_frames:
                    pct = round(5.0 + (idx / total_frames) * 75.0, 1)
                    if progress_callback:
                        progress_callback({
                            "stage": "AI_UPSCALING",
                            "progress_percent": pct,
                            "current_time_sec": round((idx / max(1.0, source_fps)), 1),
                            "encoder": f"Real-ESRGAN ({ai_model})"
                        })

            # 4. Assemble upscaled frames with FFmpeg, burn subtitles, apply grading filters, and remux audio
            filters = []
            enh_filters = build_enhancement_filter_string(enhancement)
            if enh_filters and enh_filters != "null":
                filters.append(enh_filters)

            if Path(ass_path).exists():
                escaped_ass = str(Path(ass_path).resolve()).replace("\\", "/").replace(":", "\\:")
                filters.append(f"ass='{escaped_ass}'")

            assemble_cmd = [
                ffmpeg, "-y",
                "-framerate", str(source_fps),
                "-i", str(upscaled_dir / "frame_%07d.png")
            ]

            if has_audio:
                assemble_cmd.extend(["-i", str(temp_audio)])

            if filters:
                assemble_cmd.extend(["-vf", ",".join(filters)])

            assemble_cmd.extend([
                "-c:v", codec,
                "-r", str(fps),
                "-pix_fmt", "yuv420p"
            ])

            if "nvenc" in codec:
                assemble_cmd.extend(["-cq", str(crf)])
            else:
                assemble_cmd.extend(["-crf", str(crf)])

            if has_audio:
                assemble_cmd.extend(["-c:a", audio_codec if audio_codec != "copy" else "aac"])
            else:
                assemble_cmd.extend(["-an"])

            assemble_cmd.extend([
                "-progress", "pipe:1",
                str(out_file.resolve())
            ])

            run_ffmpeg_with_progress(assemble_cmd, total_duration, codec, progress_callback, job_ref)

        finally:
            # Clean up all temporary extracted and upscaled frames
            shutil.rmtree(frames_dir, ignore_errors=True)
            shutil.rmtree(upscaled_dir, ignore_errors=True)
            if temp_audio.exists():
                try:
                    temp_audio.unlink()
                except Exception:
                    pass

    # ----------------- BRANCH 2: DIRECT HIGH-SPEED FFMPEG FILTER PIPELINE -----------------
    else:
        filters = []
        enh_filters = build_enhancement_filter_string(enhancement)
        if enh_filters and enh_filters != "null":
            filters.append(enh_filters)

        if Path(ass_path).exists():
            escaped_ass = str(Path(ass_path).resolve()).replace("\\", "/").replace(":", "\\:")
            filters.append(f"ass='{escaped_ass}'")

        cmd = [
            ffmpeg, "-y",
            "-i", str(in_file.resolve())
        ]

        if filters:
            cmd.extend(["-vf", ",".join(filters)])

        cmd.extend([
            "-c:v", codec,
            "-r", str(fps),
            "-pix_fmt", "yuv420p"
        ])

        if "nvenc" in codec:
            cmd.extend(["-cq", str(crf)])
        else:
            cmd.extend(["-crf", str(crf)])

        cmd.extend([
            "-c:a", audio_codec if audio_codec != "copy" else "aac",
            "-progress", "pipe:1",
            str(out_file.resolve())
        ])

        run_ffmpeg_with_progress(cmd, total_duration, codec, progress_callback, job_ref)

    # ----------------- VERIFICATION: PROBE FINAL RENDERED MP4 -----------------
    if not out_file.exists() or out_file.stat().st_size == 0:
        raise RuntimeError(f"Rendering failed: output file is missing or 0 bytes at {output_path}")

    # Inspect rendered file using FFprobe to verify video stream validity
    output_meta = inspect_video_file(str(out_file.resolve()))
    sz_mb = output_meta.get("file_size_mb", 0.0)
    dur = float(output_meta.get("duration_seconds", 0.0))

    if dur <= 0.0:
        raise RuntimeError(f"Rendered video verification failed: duration is 0 or stream is corrupted.")

    return {
        "success": True,
        "file_size_mb": sz_mb,
        "encoder": codec,
        "encoder_requested": requested_codec,
        "nvenc_active": "nvenc" in codec,
        "ai_model_applied": applied_ai_model,
        "enhancement_applied": build_enhancement_filter_string(enhancement),
        "output_path": str(out_file.resolve()),
        "output_metadata": output_meta
    }
