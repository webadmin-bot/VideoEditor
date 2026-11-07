import os
import platform
import shutil
import subprocess
import psutil
from typing import Dict, Any, List

def test_encoder_initialization(ffmpeg_path: str, encoder: str) -> bool:
    """
    Tests actual encoder initialization using a 0.1-second blank test encode.
    Guarantees NVENC hardware drivers and libraries can initialize properly.
    """
    if not ffmpeg_path or ffmpeg_path == "Not Found":
        return False
    try:
        cmd = [
            ffmpeg_path, "-y",
            "-f", "lavfi", "-i", "color=c=black:s=64x64:d=0.1",
            "-c:v", encoder,
            "-f", "null", "-"
        ]
        res = subprocess.run(cmd, capture_output=True, timeout=4)
        return res.returncode == 0
    except Exception:
        return False

def check_ffmpeg() -> Dict[str, Any]:
    ffmpeg_path = shutil.which("ffmpeg")
    ffprobe_path = shutil.which("ffprobe")
    available_in_binary: List[str] = []
    verified_encoders: List[str] = []

    if ffmpeg_path:
        try:
            res = subprocess.run([ffmpeg_path, "-encoders"], capture_output=True, text=True, timeout=5)
            output = res.stdout.lower()
            candidate_codecs = ["av1_nvenc", "hevc_nvenc", "h264_nvenc", "libx264", "libx265", "aac"]
            for c in candidate_codecs:
                if c in output:
                    available_in_binary.append(c)
        except Exception:
            pass

        # Perform actual initialization test for video encoders
        for c in ["av1_nvenc", "hevc_nvenc", "h264_nvenc", "libx264", "libx265"]:
            if c in available_in_binary and test_encoder_initialization(ffmpeg_path, c):
                verified_encoders.append(c)

    has_nvenc = any("nvenc" in e for e in verified_encoders)
    has_av1_nvenc = "av1_nvenc" in verified_encoders
    has_hevc_nvenc = "hevc_nvenc" in verified_encoders
    has_h264_nvenc = "h264_nvenc" in verified_encoders

    return {
        "ffmpeg_available": bool(ffmpeg_path),
        "ffmpeg_path": ffmpeg_path or "Not Found",
        "ffprobe_available": bool(ffprobe_path),
        "ffprobe_path": ffprobe_path or "Not Found",
        "encoders": available_in_binary,
        "verified_encoders": verified_encoders,
        "has_nvenc": has_nvenc,
        "has_av1_nvenc": has_av1_nvenc,
        "has_hevc_nvenc": has_hevc_nvenc,
        "has_h264_nvenc": has_h264_nvenc,
    }

def check_nvidia_smi() -> Dict[str, Any]:
    smi_path = shutil.which("nvidia-smi")
    if not smi_path and os.path.exists("C:\\Windows\\System32\\nvidia-smi.exe"):
        smi_path = "C:\\Windows\\System32\\nvidia-smi.exe"

    if smi_path:
        try:
            cmd = [smi_path, "--query-gpu=gpu_name,driver_version,memory.total,memory.free", "--format=csv,noheader,nounits"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if res.returncode == 0 and res.stdout.strip():
                parts = [p.strip() for p in res.stdout.strip().split(",")]
                return {
                    "detected": True,
                    "model": parts[0] if len(parts) > 0 else "NVIDIA GPU",
                    "driver_version": parts[1] if len(parts) > 1 else "Unknown",
                    "vram_total_mb": int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0,
                    "vram_free_mb": int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 0,
                }
        except Exception:
            pass

    return {
        "detected": False,
        "model": "Not Detected (CPU Mode)",
        "driver_version": "N/A",
        "vram_total_mb": 0,
        "vram_free_mb": 0,
    }

def check_cuda_torch() -> Dict[str, Any]:
    torch_installed = False
    cuda_available = False
    device_name = "Not Available"
    cuda_version = "N/A"
    compute_capability = "N/A"
    kernel_verified = False
    arch_compatibility = "CPU Fallback"

    try:
        import torch
        torch_installed = True
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            device_name = torch.cuda.get_device_name(0)
            cuda_version = torch.version.cuda or "Unknown"
            cap = torch.cuda.get_device_capability(0)
            compute_capability = f"sm_{cap[0]}{cap[1]}"
            arch_compatibility = f"CUDA {cuda_version} ({compute_capability})"

            # Real kernel execution check
            try:
                t = (torch.ones(2, 2, device='cuda') * 2).sum().item()
                kernel_verified = (t == 8.0)
            except Exception:
                kernel_verified = False
    except ImportError:
        pass
    except Exception:
        pass

    return {
        "torch_installed": torch_installed,
        "cuda_available": cuda_available,
        "device_name": device_name,
        "cuda_version": cuda_version,
        "compute_capability": compute_capability,
        "arch_compatibility": arch_compatibility,
        "kernel_execution_verified": kernel_verified,
        "compatibility_error": None if kernel_verified or not cuda_available else "GPU kernel execution failed"
    }

def check_ctranslate2_cuda() -> Dict[str, Any]:
    """
    Verifies CTranslate2 CUDA support independently of PyTorch.
    Checks CUDA device availability, cuDNN / cuBLAS libraries, and supported compute types.
    """
    installed = False
    cuda_available = False
    cuda_device_count = 0
    supported_compute_types: List[str] = []
    error = None

    try:
        import ctranslate2
        installed = True
        cuda_device_count = ctranslate2.get_cuda_device_count()
        cuda_available = cuda_device_count > 0
        if cuda_available:
            for c_type in ["float16", "int8_float16", "bfloat16", "int8", "float32"]:
                try:
                    if ctranslate2.models.Whisper.is_compute_type_supported("cuda", c_type):
                        supported_compute_types.append(c_type)
                except Exception:
                    pass
        else:
            error = "CTranslate2 reports 0 CUDA devices available on this host."
    except Exception as e:
        installed = False
        error = f"CTranslate2 import or CUDA query error: {str(e)}"

    return {
        "installed": installed,
        "cuda_available": cuda_available,
        "cuda_device_count": cuda_device_count,
        "supported_compute_types": supported_compute_types,
        "error": error
    }

def get_system_telemetry() -> Dict[str, Any]:
    total_mem = round(psutil.virtual_memory().total / (1024 ** 3), 1)
    avail_mem = round(psutil.virtual_memory().available / (1024 ** 3), 1)
    mem_pct = int(psutil.virtual_memory().percent)

    gpu_info = check_nvidia_smi()
    cuda_info = check_cuda_torch()
    ctranslate2_info = check_ctranslate2_cuda()
    ffmpeg_info = check_ffmpeg()

    is_blackwell = "5060" in gpu_info.get("model", "") or "Blackwell" in gpu_info.get("model", "")

    gpu_telemetry = {
        "detected": gpu_info["detected"],
        "model": gpu_info["model"],
        "architecture": "NVIDIA Blackwell (Gen 9 Dual NVENC / 5th Gen Tensor Cores)" if (gpu_info["detected"] and is_blackwell) else ("NVIDIA GPU" if gpu_info["detected"] else "None (CPU)"),
        "is_blackwell": is_blackwell and gpu_info["detected"],
        "compute_capability": cuda_info.get("compute_capability", "N/A"),
        "vram_total_mb": gpu_info.get("vram_total_mb", 0),
        "vram_free_mb": gpu_info.get("vram_free_mb", 0),
        "driver_version": gpu_info.get("driver_version", "N/A"),
        "cuda_version": cuda_info.get("cuda_version", "N/A"),
    }

    if ffmpeg_info.get("has_av1_nvenc"):
        recommended_encoder = "av1_nvenc"
    elif ffmpeg_info.get("has_hevc_nvenc"):
        recommended_encoder = "hevc_nvenc"
    elif ffmpeg_info.get("has_h264_nvenc"):
        recommended_encoder = "h264_nvenc"
    elif "libx264" in ffmpeg_info.get("verified_encoders", []):
        recommended_encoder = "libx264"
    else:
        recommended_encoder = "libx264"

    free_vram = gpu_telemetry["vram_free_mb"]
    if gpu_info["detected"] and free_vram > 6000:
        recommended_tile = 1024
    elif gpu_info["detected"] and free_vram > 3000:
        recommended_tile = 512
    else:
        recommended_tile = 256

    return {
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "cpu_model": platform.processor() or "Multi-core Processor",
        "cpu_cores_physical": psutil.cpu_count(logical=False) or 4,
        "cpu_cores_logical": psutil.cpu_count(logical=True) or 8,
        "ram_total_gb": total_mem,
        "ram_available_gb": avail_mem,
        "ram_percent_used": mem_pct,
        "gpu": gpu_telemetry,
        "cuda": cuda_info,
        "ctranslate2": ctranslate2_info,
        "ffmpeg": ffmpeg_info,
        "recommended_encoder": recommended_encoder,
        "recommended_upscale_tile": recommended_tile,
    }
