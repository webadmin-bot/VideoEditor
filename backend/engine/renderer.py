import shutil
import subprocess
import os
import json
import time
from pathlib import Path
from typing import Dict, Any, Callable, Optional
from .enhancer import build_enhancement_filter_string
from .hardware import check_ffmpeg, check_nvidia_smi

def render_final_video(
    input_video_path: str,
    output_video_path: str,
    ass_subtitle_path: Optional[str],
    enhancement_config: Dict[str, Any],
    export_config: Dict[str, Any],
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
) -> Dict[str, Any]:
    """
    Renders the final processed video using FFmpeg.
    Burns kinetic ASS subtitles, applies enhancements, and encodes with GPU/CPU.
    """
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg executable not found on system PATH.")

    in_path = Path(input_video_path)
    out_path = Path(output_video_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Determine hardware encoder
    gpu_info = check_nvidia_smi()
    ffmpeg_info = check_ffmpeg()
    
    preferred_codec = export_config.get("videoCodec", "auto")
    encoders_avail = ffmpeg_info.get("encoders", [])
    has_gpu = gpu_info.get("detected", False)

    # Blackwell Gen 9 NVENC supports AV1, HEVC, and H.264
    if preferred_codec == "av1_nvenc" or (preferred_codec == "auto" and has_gpu and "av1_nvenc" in encoders_avail):
        vcodec = "av1_nvenc" if (has_gpu and "av1_nvenc" in encoders_avail) else "libsvtav1"
    elif preferred_codec in ["hevc", "hevc_nvenc"]:
        vcodec = "hevc_nvenc" if (has_gpu and "hevc_nvenc" in encoders_avail) else "libx265"
    elif preferred_codec in ["h264_nvenc", "h264", "auto"]:
        vcodec = "h264_nvenc" if (has_gpu and "h264_nvenc" in encoders_avail) else "libx264"
    else:
        vcodec = preferred_codec

    # Assemble filter chain
    filter_elements = []

    target_w = export_config.get("width", 1920)
    target_h = export_config.get("height", 1080)

    # 1. Video enhancement filters (denoise, eq, unsharp)
    enh_filters = build_enhancement_filter_string(enhancement_config, target_w, target_h)
    if enh_filters:
        filter_elements.append(enh_filters)

    # 2. Burn kinetic subtitles if provided
    if ass_subtitle_path and Path(ass_subtitle_path).exists():
        # Escape path for FFmpeg filter syntax (especially colons and backslashes on Windows)
        safe_ass_path = str(Path(ass_subtitle_path).resolve()).replace("\\", "/").replace(":", "\\:")
        filter_elements.append(f"ass='{safe_ass_path}'")

    combined_filter = ",".join(filter_elements) if filter_elements else None

    # Quality preset and bitrate
    quality_crf = export_config.get("qualityCrf", 20)
    preset = "p4" if "nvenc" in vcodec else "medium"

    cmd = [
        ffmpeg,
        "-y",
        "-i", str(in_path)
    ]

    if combined_filter:
        cmd.extend(["-vf", combined_filter])

    cmd.extend([
        "-c:v", vcodec,
        "-preset", preset,
    ])

    if "nvenc" in vcodec:
        cmd.extend(["-cq", str(quality_crf), "-b:v", "0"])
    else:
        cmd.extend(["-crf", str(quality_crf)])

    # Audio handling: preserve original or encode to AAC
    audio_codec = export_config.get("audioCodec", "copy")
    if audio_codec == "copy":
        cmd.extend(["-c:a", "copy"])
    else:
        cmd.extend(["-c:a", "aac", "-b:a", "192k"])

    # Progress reporting pipe
    cmd.extend([
        "-progress", "pipe:1",
        str(out_path)
    ])

    start_time = time.time()

    # Execute FFmpeg process with safe pipe reading
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        universal_newlines=True
    )

    total_duration_sec = export_config.get("duration", 10.0)

    try:
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            
            line_str = line.strip()
            if line_str.startswith("out_time_ms="):
                try:
                    out_time_us = int(line_str.split("=")[1])
                    curr_sec = out_time_us / 1000000.0
                    pct = min(99.0, max(0.0, (curr_sec / max(0.1, total_duration_sec)) * 100.0))
                    elapsed = time.time() - start_time
                    eta = (elapsed / max(1.0, curr_sec)) * (total_duration_sec - curr_sec) if curr_sec > 0 else 0

                    if progress_callback:
                        progress_callback({
                            "stage": "RENDERING",
                            "progress_percent": round(pct, 1),
                            "current_time_sec": round(curr_sec, 2),
                            "elapsed_seconds": round(elapsed, 1),
                            "estimated_remaining_seconds": round(max(0, eta), 1),
                            "encoder": vcodec
                        })
                except Exception:
                    pass

        returncode = process.wait()
        if returncode != 0:
            stderr_out = process.stderr.read()
            raise RuntimeError(f"FFmpeg rendering failed with exit code {returncode}: {stderr_out}")

    except Exception as e:
        process.kill()
        raise e

    elapsed_total = round(time.time() - start_time, 2)
    out_size_mb = round(out_path.stat().st_size / (1024 * 1024), 2) if out_path.exists() else 0.0

    return {
        "success": True,
        "output_path": str(out_path),
        "file_size_mb": out_size_mb,
        "elapsed_seconds": elapsed_total,
        "encoder_used": vcodec,
        "burned_subtitles": bool(ass_subtitle_path),
        "target_resolution": f"{target_w}x{target_h}"
    }
