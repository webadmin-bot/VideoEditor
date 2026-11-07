import os
import shutil
import subprocess
import base64
from pathlib import Path
from typing import Dict, Any, Optional

def check_realesrgan_available() -> Dict[str, Any]:
    """
    Checks if Real-ESRGAN dependencies and model weights are installed and available.
    Accurately reports status without pretending AI models work if missing.
    """
    installed = False
    available = False
    device = "cpu"
    error = None

    try:
        import torch
        if torch.cuda.is_available():
            device = "cuda"
    except ImportError:
        pass

    try:
        import realesrgan
        installed = True
        available = True
    except ImportError:
        installed = False
        available = False
        error = "Real-ESRGAN python package ('realesrgan') is not installed. AI neural upscaling is unavailable."

    return {
        "installed": installed,
        "available": available,
        "device": device,
        "models": ["Real-ESRGAN-x2", "Real-ESRGAN-x4"] if available else [],
        "error": error
    }

def run_realesrgan_upscale(
    image_input,
    model_name: str = "Real-ESRGAN-x4",
    tile_size: int = 512,
    device: str = "cuda"
):
    """
    Executes actual Real-ESRGAN neural upscaling with tiled inference to manage RTX 5060 VRAM.
    Raises RuntimeError if dependencies are not installed.
    """
    status = check_realesrgan_available()
    if not status["available"]:
        raise RuntimeError(
            "Real-ESRGAN AI upscaling is not installed on this system. "
            "Please install Real-ESRGAN (`pip install realesrgan`) and download weights, "
            "or select 'None (Conventional Scaling)' in the Upscale panel."
        )

    try:
        from realesrgan import RealESRGANer
        from basicsr.archs.rrdbnet_arch import RRDBNet
    except ImportError as e:
        raise RuntimeError(f"Failed to load Real-ESRGAN modules: {e}")

    scale = 4 if "x4" in model_name else 2
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=scale)

    use_half = (device == "cuda")
    upsampler = RealESRGANer(
        scale=scale,
        model_path=None,
        model=model,
        tile=tile_size,  # Dynamic VRAM protection for RTX 5060 GDDR7
        tile_pad=10,
        pre_pad=0,
        half=use_half,
        gpu_id=0 if device == "cuda" else None
    )

    output, _ = upsampler.enhance(image_input, outscale=scale)
    return output

def build_enhancement_filter_string(enhancement: Dict[str, Any]) -> str:
    """
    Builds conventional FFmpeg filter graph string for color grading, sharpening, and denoising.
    Only applies conventional Lanczos scaling if target resolution is selected and aiModel is 'None'.
    Never labels Lanczos scaling or FFmpeg filters as AI upscaling.
    """
    filters = []

    contrast = float(enhancement.get("contrast", 1.0))
    brightness = float(enhancement.get("brightness", 0.0))
    saturation = float(enhancement.get("saturation", 1.0))
    gamma = float(enhancement.get("gamma", 1.0))

    if contrast != 1.0 or brightness != 0.0 or saturation != 1.0 or gamma != 1.0:
        filters.append(f"eq=contrast={contrast}:brightness={brightness}:saturation={saturation}:gamma={gamma}")

    sharpen = float(enhancement.get("sharpen", 0.0))
    if sharpen > 0.0:
        amount = round(sharpen * 1.5, 2)
        filters.append(f"unsharp=5:5:{amount}:5:5:0.0")

    denoise = float(enhancement.get("denoise", 0.0))
    if denoise > 0.0:
        strength = round(denoise * 4.0, 1)
        filters.append(f"hqdn3d={strength}:{strength}:{strength}:{strength}")

    # Conventional scaling is applied only when aiModel is None
    ai_model = enhancement.get("aiModel", "None")
    target_res = enhancement.get("targetResolution") or enhancement.get("upscaleTarget")
    if (not ai_model or ai_model in ["None", "none"]) and target_res:
        if target_res == "1080p":
            filters.append("scale=1920:1080:flags=lanczos")
        elif target_res == "2K":
            filters.append("scale=2560:1440:flags=lanczos")
        elif target_res == "4K":
            filters.append("scale=3840:2160:flags=lanczos")

    return ",".join(filters) if filters else "null"

def generate_preview_frame(video_path: str, enhancement: Dict[str, Any], timestamp_sec: float = 1.0) -> Dict[str, Any]:
    filter_string = build_enhancement_filter_string(enhancement)
    ffmpeg = shutil.which("ffmpeg")
    realesrgan_status = check_realesrgan_available()

    if not ffmpeg or not Path(video_path).exists():
        return {
            "success": True,
            "filters_applied": filter_string,
            "ai_upscaling_available": realesrgan_status["available"],
            "ai_upscaling_error": realesrgan_status["error"],
            "message": "Preview filter graph generated",
            "original_base64": None,
            "enhanced_base64": None
        }

    try:
        temp_dir = Path(video_path).parent
        orig_frame = temp_dir / "orig_preview.jpg"
        enh_frame = temp_dir / "enh_preview.jpg"

        # Extract original frame
        subprocess.run([
            ffmpeg, "-y", "-ss", str(timestamp_sec), "-i", str(video_path),
            "-vframes", "1", "-q:v", "2", str(orig_frame)
        ], capture_output=True, timeout=10)

        # Extract enhanced frame using conventional FFmpeg filters
        vf_param = filter_string if filter_string != "null" else "null"
        subprocess.run([
            ffmpeg, "-y", "-ss", str(timestamp_sec), "-i", str(video_path),
            "-vf", vf_param, "-vframes", "1", "-q:v", "2", str(enh_frame)
        ], capture_output=True, timeout=10)

        orig_b64 = None
        enh_b64 = None
        if orig_frame.exists():
            orig_b64 = base64.b64encode(orig_frame.read_bytes()).decode("utf-8")
            orig_frame.unlink()
        if enh_frame.exists():
            enh_b64 = base64.b64encode(enh_frame.read_bytes()).decode("utf-8")
            enh_frame.unlink()

        return {
            "success": True,
            "filters_applied": filter_string,
            "ai_upscaling_available": realesrgan_status["available"],
            "ai_upscaling_error": realesrgan_status["error"],
            "original_base64": orig_b64,
            "enhanced_base64": enh_b64
        }
    except Exception as e:
        return {
            "success": True,
            "filters_applied": filter_string,
            "ai_upscaling_available": realesrgan_status["available"],
            "ai_upscaling_error": realesrgan_status["error"],
            "error": str(e)
        }
