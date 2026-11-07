import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from .enhancer import build_enhancement_filter_string
from .video_inspector import inspect_video_file
from .hardware import check_ffmpeg, test_encoder_initialization

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

    # Inspect input to determine duration for accurate progress computation
    input_meta = inspect_video_file(str(in_file.resolve()))
    total_duration = max(0.5, float(input_meta.get("duration_seconds", 1.0)))

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg executable is not available on system PATH.")

    requested_codec = export_settings.get("videoCodec", "auto")
    hw_info = check_ffmpeg()
    verified_encoders = hw_info.get("verified_encoders", [])

    if requested_codec == "auto":
        # Select best successfully verified hardware encoder
        if "av1_nvenc" in verified_encoders:
            codec = "av1_nvenc"
        elif "hevc_nvenc" in verified_encoders:
            codec = "hevc_nvenc"
        elif "h264_nvenc" in verified_encoders:
            codec = "h264_nvenc"
        else:
            codec = "libx264"
    else:
        # User specified an encoder — verify it actually initializes on current hardware
        if "nvenc" in requested_codec:
            if requested_codec in verified_encoders or test_encoder_initialization(ffmpeg, requested_codec):
                codec = requested_codec
            else:
                # NVENC initialization failed on hardware, fallback to libx264
                codec = "libx264"
        else:
            codec = requested_codec

    crf = export_settings.get("qualityCrf", 20)
    audio_codec = export_settings.get("audioCodec", "copy")
    fps = export_settings.get("fps", 30)

    # Validate AI model if selected
    ai_model = enhancement.get("aiModel", "None")
    if ai_model and ai_model not in ["None", "none", ""]:
        from .enhancer import check_realesrgan_available
        realesr_status = check_realesrgan_available()
        if not realesr_status["available"]:
            raise RuntimeError(
                f"AI upscaling was requested with model '{ai_model}', but Real-ESRGAN is not installed. "
                "Please install Real-ESRGAN (`pip install realesrgan`) and model weights, "
                "or set AI Engine Model to 'None (Conventional Scaling)' in the Upscale panel."
            )

    # Build filter chain
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
    ])

    if "nvenc" in codec:
        cmd.extend(["-cq", str(crf)])
    else:
        cmd.extend(["-crf", str(crf)])

    cmd.extend([
        "-c:a", audio_codec if audio_codec != "copy" else "aac",
        "-progress", "pipe:1",
        str(Path(output_path).resolve())
    ])

    # Launch subprocess with piped progress
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    if job_ref and hasattr(job_ref, "set_process"):
        job_ref.set_process(proc)

    # Read progress from stdout
    last_reported_pct = 0.0
    while True:
        if job_ref and getattr(job_ref, "cancelled", False):
            proc.terminate()
            time.sleep(0.1)
            proc.kill()
            raise RuntimeError("Rendering cancelled by user.")

        line = proc.stdout.readline() if proc.stdout else ""
        if not line and proc.poll() is not None:
            break

        line = line.strip()
        if line.startswith("out_time_us="):
            try:
                us_val = int(line.split("=")[1])
                cur_secs = us_val / 1000000.0
                pct = min(99.0, max(0.0, (cur_secs / total_duration) * 100.0))
                if round(pct, 1) != last_reported_pct:
                    last_reported_pct = round(pct, 1)
                    if progress_callback:
                        progress_callback({
                            "stage": "RENDERING",
                            "progress_percent": last_reported_pct,
                            "current_time_sec": round(cur_secs, 1),
                            "encoder": codec
                        })
            except (ValueError, IndexError):
                pass
        elif line == "progress=end":
            break

    _, stderr = proc.communicate()
    if proc.returncode != 0:
        err_msg = stderr.strip() if stderr else "Unknown FFmpeg error"
        raise RuntimeError(f"FFmpeg rendering failed (code {proc.returncode}): {err_msg}")

    # Validate output using FFprobe
    out_file = Path(output_path)
    if not out_file.exists() or out_file.stat().st_size == 0:
        raise RuntimeError(f"Render completed but output file does not exist or is 0 bytes: {output_path}")

    # Inspect rendered file to guarantee container and video stream integrity
    output_meta = inspect_video_file(str(out_file.resolve()))
    sz_mb = output_meta.get("file_size_mb", 0.0)

    return {
        "success": True,
        "file_size_mb": sz_mb,
        "encoder": codec,
        "encoder_requested": requested_codec,
        "nvenc_active": "nvenc" in codec,
        "output_path": str(out_file.resolve()),
        "output_metadata": output_meta
    }
