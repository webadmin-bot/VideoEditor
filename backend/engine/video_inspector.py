import os
import json
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any

def inspect_video_file(filepath: str) -> Dict[str, Any]:
    file_path_obj = Path(filepath)
    if not file_path_obj.exists():
        raise FileNotFoundError(f"Video file does not exist on disk: {filepath}")

    file_size = file_path_obj.stat().st_size
    if file_size == 0:
        raise ValueError(f"Video file is empty (0 bytes): {filepath}")

    file_size_mb = round(file_size / (1024 * 1024), 2)

    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        raise RuntimeError("FFprobe executable is not available on system PATH. Please install FFmpeg.")

    cmd = [
        ffprobe,
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(file_path_obj.resolve())
    ]

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    except subprocess.TimeoutExpired:
        raise TimeoutError(f"FFprobe timed out inspecting: {filepath}")
    except Exception as e:
        raise RuntimeError(f"Failed to execute FFprobe: {str(e)}")

    if res.returncode != 0:
        err_msg = res.stderr.strip() or "Unknown FFprobe failure"
        raise RuntimeError(f"FFprobe error inspecting video: {err_msg}")

    try:
        data = json.loads(res.stdout)
    except json.JSONDecodeError as e:
        raise ValueError(f"FFprobe produced invalid JSON output: {str(e)}")

    streams = data.get("streams", [])
    format_info = data.get("format", {})

    v_streams = [s for s in streams if s.get("codec_type") == "video"]
    if not v_streams:
        raise ValueError(f"No video streams detected in media file: {file_path_obj.name}")

    v = v_streams[0]
    width = int(v.get("width", 0))
    height = int(v.get("height", 0))
    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid video dimensions detected ({width}x{height}) in {file_path_obj.name}")

    video_codec = v.get("codec_name", "unknown")

    # Determine frame rate
    r_frame_rate = v.get("r_frame_rate", "0/1")
    fps = 0.0
    if "/" in r_frame_rate:
        num, den = r_frame_rate.split("/")
        den_val = float(den)
        if den_val > 0:
            fps = round(float(num) / den_val, 2)
    elif r_frame_rate:
        try:
            fps = round(float(r_frame_rate), 2)
        except ValueError:
            fps = 0.0

    # Determine duration
    duration = 0.0
    if "duration" in format_info:
        try:
            duration = round(float(format_info["duration"]), 2)
        except ValueError:
            pass
    elif "duration" in v:
        try:
            duration = round(float(v["duration"]), 2)
        except ValueError:
            pass

    # Determine bitrate
    bitrate = 0
    if "bit_rate" in format_info:
        try:
            bitrate = int(int(format_info["bit_rate"]) / 1000)
        except (ValueError, TypeError):
            pass

    # Audio stream inspection
    a_streams = [s for s in streams if s.get("codec_type") == "audio"]
    has_audio = len(a_streams) > 0
    audio_codec = ""
    audio_channels = 0
    audio_sample_rate = 0

    if has_audio:
        a = a_streams[0]
        audio_codec = a.get("codec_name", "")
        audio_channels = int(a.get("channels", 0))
        audio_sample_rate = int(a.get("sample_rate", 0))

    format_name = format_info.get("format_name", file_path_obj.suffix.replace(".", "").upper())

    return {
        "filename": file_path_obj.name,
        "filepath": str(file_path_obj.resolve()),
        "file_size_bytes": file_size,
        "file_size_mb": file_size_mb,
        "format_name": format_name,
        "duration_seconds": duration,
        "width": width,
        "height": height,
        "aspect_ratio": f"{width}:{height}",
        "fps": fps,
        "video_codec": video_codec,
        "audio_codec": audio_codec,
        "audio_channels": audio_channels,
        "audio_sample_rate": audio_sample_rate,
        "bitrate_kbps": bitrate,
        "has_audio": has_audio,
    }
