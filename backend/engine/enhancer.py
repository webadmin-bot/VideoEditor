import shutil
import subprocess
import base64
from pathlib import Path
from typing import Dict, Any, Optional

def build_enhancement_filter_string(enhancement_config: Dict[str, Any], target_width: int, target_height: int) -> str:
    """Builds an FFmpeg filtergraph string for video enhancement."""
    filters = []

    denoise = enhancement_config.get("denoiseStrength", 0)
    if denoise > 0:
        luma = round(denoise / 10.0, 1)
        chroma = round(denoise / 15.0, 1)
        filters.append(f"hqdn3d={luma}:{chroma}:4:4")

    contrast = float(enhancement_config.get("contrast", 1.0))
    saturation = float(enhancement_config.get("saturation", 1.0))
    brightness = float(enhancement_config.get("brightness", 0.0))

    if contrast != 1.0 or saturation != 1.0 or brightness != 0.0:
        filters.append(f"eq=contrast={contrast:.2f}:brightness={brightness:.2f}:saturation={saturation:.2f}")

    sharpen = enhancement_config.get("sharpenStrength", 0)
    if sharpen > 0:
        amount = round(sharpen / 50.0, 2)
        filters.append(f"unsharp=5:5:{amount:.2f}:5:5:0.0")

    ai_model = enhancement_config.get("aiModel", "None")
    if ai_model == "None" and target_width > 0 and target_height > 0:
        filters.append(f"scale={target_width}:{target_height}:flags=lanczos")

    return ",".join(filters)

def generate_preview_frame(
    video_path: str,
    enhancement_config: Dict[str, Any],
    timestamp_sec: float = 1.0
) -> Dict[str, Any]:
    """Generates an original vs enhanced comparison frame preview."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg or not Path(video_path).exists():
        return {
            "success": False,
            "error": "FFmpeg or video file not available",
            "original_base64": None,
            "enhanced_base64": None
        }

    # Extract original frame
    orig_cmd = [
        ffmpeg, "-y",
        "-ss", str(timestamp_sec),
        "-i", str(video_path),
        "-vframes", "1",
        "-f", "image2pipe",
        "-vcodec", "mjpeg",
        "pipe:1"
    ]
    orig_res = subprocess.run(orig_cmd, capture_output=True)
    orig_b64 = "data:image/jpeg;base64," + base64.b64encode(orig_res.stdout).decode("utf-8") if orig_res.returncode == 0 else None

    # Extract enhanced frame
    filter_chain = build_enhancement_filter_string(enhancement_config, 1920, 1080)
    enh_cmd = [
        ffmpeg, "-y",
        "-ss", str(timestamp_sec),
        "-i", str(video_path),
        "-vframes", "1"
    ]
    if filter_chain:
        enh_cmd.extend(["-vf", filter_chain])
    enh_cmd.extend(["-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"])

    enh_res = subprocess.run(enh_cmd, capture_output=True)
    enh_b64 = "data:image/jpeg;base64," + base64.b64encode(enh_res.stdout).decode("utf-8") if enh_res.returncode == 0 else orig_b64

    return {
        "success": True,
        "original_base64": orig_b64,
        "enhanced_base64": enh_b64,
        "filters_applied": filter_chain
    }
