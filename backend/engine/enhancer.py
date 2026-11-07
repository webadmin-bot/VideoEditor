import os
import shutil
import subprocess
import base64
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
try:
    import numpy as np
except ImportError:
    np = None  # type: ignore


from ..config import MODELS_DIR, TEMP_DIR

logger = logging.getLogger("ai_video_studio.enhancer")

MODEL_WEIGHTS_MAP = {
    "Real-ESRGAN-x4": "RealESRGAN_x4plus.pth",
    "Real-ESRGAN-x2": "RealESRGAN_x2plus.pth",
    "RealESRGAN_x4plus": "RealESRGAN_x4plus.pth",
    "RealESRGAN_x2plus": "RealESRGAN_x2plus.pth"
}

def find_model_weights(model_name: str) -> Optional[Path]:
    """
    Locates verified model weights on local storage.
    Verifies that the file exists and has valid non-trivial size (> 1MB).
    """
    filename = MODEL_WEIGHTS_MAP.get(model_name, "RealESRGAN_x4plus.pth")
    candidate_paths = [
        MODELS_DIR / filename,
        Path("storage/models/realesrgan") / filename,
        Path("weights") / filename,
        Path("backend/weights") / filename,
        Path.home() / ".cache" / "realesrgan" / filename
    ]

    for p in candidate_paths:
        try:
            if p.exists() and p.is_file() and p.stat().st_size > 1024 * 1024:
                return p.resolve()
        except Exception:
            continue

    return None

def check_realesrgan_available() -> Dict[str, Any]:
    """
    Checks if Real-ESRGAN packages, architecture dependencies, and actual weights exist.
    Never reports AI upscaling as available unless weights exist on local disk.
    """
    installed = False
    available = False
    device = "cpu"
    errors = []
    found_models: List[str] = []

    # 1. PyTorch & Device Check
    try:
        import torch
        if torch.cuda.is_available():
            device = "cuda"
    except ImportError:
        errors.append("PyTorch is not installed in the Python environment.")

    # 2. Package & Architecture Check
    try:
        import realesrgan
        from realesrgan import RealESRGANer
        from basicsr.archs.rrdbnet_arch import RRDBNet
        installed = True
    except ImportError as e:
        installed = False
        errors.append(f"Real-ESRGAN / BasicSR package import failed: {e}")

    # 3. Weights Check
    if installed:
        for m_name in ["Real-ESRGAN-x4", "Real-ESRGAN-x2"]:
            w_path = find_model_weights(m_name)
            if w_path:
                found_models.append(m_name)

        if found_models:
            available = True
        else:
            errors.append(
                f"Real-ESRGAN model weights not found. Please place 'RealESRGAN_x4plus.pth' "
                f"or 'RealESRGAN_x2plus.pth' in {MODELS_DIR}"
            )

    return {
        "installed": installed,
        "available": available,
        "device": device,
        "models": found_models,
        "weights_dir": str(MODELS_DIR),
        "error": " | ".join(errors) if errors else None
    }

def load_realesrgan_upsampler(
    model_name: str = "Real-ESRGAN-x4",
    tile_size: int = 512,
    device: Optional[str] = None
):
    """
    Constructs and returns an instantiated RealESRGANer with verified model architecture,
    valid weights path, and tiled processing for RTX 5060 VRAM protection.
    Raises RuntimeError if model weights or modules are unavailable.
    """
    status = check_realesrgan_available()
    if not status["available"]:
        raise RuntimeError(
            f"Real-ESRGAN AI upscaling is unavailable: {status.get('error') or 'Dependencies missing.'} "
            "Please download model weights or select 'None (Conventional Lanczos)'."
        )

    weights_path = find_model_weights(model_name)
    if not weights_path:
        raise RuntimeError(
            f"Model weights for '{model_name}' ({MODEL_WEIGHTS_MAP.get(model_name)}) "
            f"not found in {MODELS_DIR} or cache directories."
        )

    try:
        import torch
        from realesrgan import RealESRGANer
        from basicsr.archs.rrdbnet_arch import RRDBNet
    except ImportError as e:
        raise RuntimeError(f"Failed to import Real-ESRGAN modules: {e}")

    scale = 4 if "x4" in model_name else 2
    target_device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    use_half = (target_device == "cuda")

    # Valid RRDBNet configuration for RealESRGAN
    model = RRDBNet(
        num_in_ch=3,
        num_out_ch=3,
        num_feat=64,
        num_block=23,
        num_grow_ch=32,
        scale=scale
    )

    upsampler = RealESRGANer(
        scale=scale,
        model_path=str(weights_path),
        model=model,
        tile=tile_size,       # Tiled inference avoids CUDA OOM on RTX 5060
        tile_pad=10,
        pre_pad=0,
        half=use_half,
        device=torch.device(target_device)
    )

    return upsampler

def test_realesrgan_inference(model_name: str = "Real-ESRGAN-x4", device: str = "cuda") -> Dict[str, Any]:
    """
    Runs actual inference on a synthetic test image to verify CUDA/CPU tensor execution.
    """
    try:
        upsampler = load_realesrgan_upsampler(model_name=model_name, tile_size=256, device=device)
        dummy_img = np.zeros((32, 32, 3), dtype=np.uint8)
        dummy_img[8:24, 8:24, :] = 200

        output, _ = upsampler.enhance(dummy_img, outscale=upsampler.scale)
        return {
            "success": True,
            "device": device,
            "input_shape": dummy_img.shape,
            "output_shape": output.shape,
            "scale": upsampler.scale
        }
    except Exception as e:
        return {
            "success": False,
            "device": device,
            "error": str(e)
        }

def build_enhancement_filter_string(enhancement: Dict[str, Any]) -> str:
    """
    Builds conventional FFmpeg filter graph string for color grading, sharpening, and denoising.
    Applies standard Lanczos scaling ONLY when aiModel is 'None'.
    Never labels Lanczos scaling as AI upscaling.
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
        temp_dir = TEMP_DIR
        preview_id = f"prev_{os.getpid()}"
        orig_frame = temp_dir / f"{preview_id}_orig.jpg"
        enh_frame = temp_dir / f"{preview_id}_enh.jpg"

        subprocess.run([
            ffmpeg, "-y", "-ss", str(timestamp_sec), "-i", str(Path(video_path).resolve()),
            "-vframes", "1", "-q:v", "2", str(orig_frame)
        ], capture_output=True, timeout=10)

        vf_param = filter_string if filter_string != "null" else "null"
        subprocess.run([
            ffmpeg, "-y", "-ss", str(timestamp_sec), "-i", str(Path(video_path).resolve()),
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
