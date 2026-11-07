import shutil
import subprocess
import platform
import psutil
from typing import Dict, Any, List

def check_nvidia_smi() -> Dict[str, Any]:
    """Detects NVIDIA GPU details via nvidia-smi with dynamic VRAM and driver checks."""
    gpu_info = {
        "detected": False,
        "model": "None detected",
        "architecture": "Standard",
        "is_blackwell": False,
        "vram_total_mb": 0,
        "vram_free_mb": 0,
        "driver_version": "N/A",
        "cuda_version": "N/A",
        "compatibility_warning": None,
    }

    nvidia_smi_path = shutil.which("nvidia-smi")
    if not nvidia_smi_path:
        return gpu_info

    try:
        # Run detailed query for model, total memory, free memory, and driver version
        res = subprocess.run(
            [nvidia_smi_path, "--query-gpu=name,memory.total,memory.free,driver_version", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=4
        )
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split("\n")[0].split(",")]
            if len(parts) >= 4:
                gpu_info["detected"] = True
                gpu_info["model"] = parts[0]
                # Never assume fixed capacity; store dynamically measured VRAM
                gpu_info["vram_total_mb"] = int(float(parts[1]))
                gpu_info["vram_free_mb"] = int(float(parts[2]))
                gpu_info["driver_version"] = parts[3]

                # Identify NVIDIA Blackwell Architecture (RTX 50-series)
                m_upper = parts[0].upper()
                if "5060" in m_upper or "5070" in m_upper or "5080" in m_upper or "5090" in m_upper or "RTX 50" in m_upper or "BLACKWELL" in m_upper:
                    gpu_info["is_blackwell"] = True
                    gpu_info["architecture"] = "NVIDIA Blackwell (Gen 9 NVENC / 5th Gen Tensor Cores)"

                    # Validate driver requirement (RTX 5060 requires Driver >= 570.xx)
                    try:
                        driver_num = float("".join([c for c in parts[3].split(".")[0] if c.isdigit()]))
                        if driver_num > 0 and driver_num < 570:
                            gpu_info["compatibility_warning"] = (
                                f"Driver version {parts[3]} detected. NVIDIA GeForce RTX 5060 requires driver 570.xx or newer for Blackwell CUDA compatibility."
                            )
                    except Exception:
                        pass
    except Exception:
        pass

    return gpu_info

def check_cuda_torch() -> Dict[str, Any]:
    """
    Checks PyTorch CUDA initialization and tests tensor kernel execution on the GPU.
    Verifies that installed PyTorch supports the RTX 5060 Blackwell compute capability.
    """
    cuda_info = {
        "torch_installed": False,
        "cuda_available": False,
        "device_name": None,
        "cuda_version": None,
        "compute_capability": None,
        "kernel_execution_verified": False,
        "arch_compatibility": "Standard",
        "compatibility_error": None
    }

    try:
        import torch
        cuda_info["torch_installed"] = True
        cuda_info["cuda_version"] = torch.version.cuda

        if torch.cuda.is_available():
            dev_name = torch.cuda.get_device_name(0)
            cuda_info["device_name"] = dev_name
            
            # Check compute capability
            major, minor = torch.cuda.get_device_capability(0)
            cuda_info["compute_capability"] = f"sm_{major}{minor}"

            # Test actual GPU kernel execution to catch missing kernel images
            try:
                x = torch.zeros((1, 1), device="cuda")
                y = x + 1.0
                torch.cuda.synchronize()
                cuda_info["kernel_execution_verified"] = True
                cuda_info["cuda_available"] = True
                cuda_info["arch_compatibility"] = f"Verified Compatible ({cuda_info['compute_capability']})"
            except Exception as kernel_err:
                cuda_info["cuda_available"] = False
                cuda_info["compatibility_error"] = (
                    f"CUDA execution failed for {dev_name} ({cuda_info['compute_capability']}): {str(kernel_err)}. "
                    "For NVIDIA GeForce RTX 5060 (Blackwell), install PyTorch with CUDA 12.8+: "
                    "pip install --upgrade torch torchvision --index-url https://download.pytorch.org/whl/cu128"
                )
    except Exception as e:
        cuda_info["compatibility_error"] = str(e)

    return cuda_info

def check_ffmpeg() -> Dict[str, Any]:
    """Checks FFmpeg hardware encoders including AV1 NVENC, HEVC NVENC, and H.264 NVENC."""
    ffmpeg_path = shutil.which("ffmpeg")
    ffprobe_path = shutil.which("ffprobe")

    encoders: List[str] = []
    has_nvenc = False
    has_av1_nvenc = False

    if ffmpeg_path:
        try:
            res = subprocess.run([ffmpeg_path, "-encoders"], capture_output=True, text=True, timeout=3)
            out = res.stdout.lower()
            if "av1_nvenc" in out:
                encoders.append("av1_nvenc")
                has_av1_nvenc = True
                has_nvenc = True
            if "hevc_nvenc" in out:
                encoders.append("hevc_nvenc")
                has_nvenc = True
            if "h264_nvenc" in out:
                encoders.append("h264_nvenc")
                has_nvenc = True
            if "h264_qsv" in out:
                encoders.append("h264_qsv")
            if "h264_amf" in out:
                encoders.append("h264_amf")
            if "libx264" in out:
                encoders.append("libx264")
            if "libx265" in out:
                encoders.append("libx265")
        except Exception:
            pass

    return {
        "ffmpeg_available": bool(ffmpeg_path),
        "ffmpeg_path": ffmpeg_path,
        "ffprobe_available": bool(ffprobe_path),
        "ffprobe_path": ffprobe_path,
        "encoders": encoders,
        "has_nvenc": has_nvenc,
        "has_av1_nvenc": has_av1_nvenc
    }

def get_system_telemetry() -> Dict[str, Any]:
    """Aggregates comprehensive hardware telemetry with dynamic VRAM and encoder selection."""
    gpu = check_nvidia_smi()
    cuda = check_cuda_torch()
    ffmpeg = check_ffmpeg()

    vm = psutil.virtual_memory()

    # Determine recommended encoder: Prefer AV1 NVENC on RTX 5060 if available, then H264 NVENC
    recommended_encoder = "libx264"
    if gpu["detected"] and ffmpeg["has_nvenc"]:
        if ffmpeg["has_av1_nvenc"]:
            recommended_encoder = "av1_nvenc"
        elif "h264_nvenc" in ffmpeg["encoders"]:
            recommended_encoder = "h264_nvenc"
        elif "hevc_nvenc" in ffmpeg["encoders"]:
            recommended_encoder = "hevc_nvenc"

    # Dynamically calculate upscale tile size from actual free VRAM (never assume fixed capacity)
    vram_free = gpu.get("vram_free_mb", 0)
    if vram_free >= 10000:
        recommended_tile = 1024
    elif vram_free >= 6000:
        recommended_tile = 512
    elif vram_free >= 3000:
        recommended_tile = 384
    else:
        recommended_tile = 256

    return {
        "os": f"{platform.system()} {platform.release()}",
        "cpu_model": platform.processor() or "Multi-core x86_64",
        "cpu_cores_physical": psutil.cpu_count(logical=False) or 4,
        "cpu_cores_logical": psutil.cpu_count(logical=True) or 8,
        "ram_total_gb": round(vm.total / (1024 ** 3), 1),
        "ram_available_gb": round(vm.available / (1024 ** 3), 1),
        "ram_percent_used": vm.percent,
        "gpu": gpu,
        "cuda": cuda,
        "ffmpeg": ffmpeg,
        "recommended_encoder": recommended_encoder,
        "recommended_upscale_tile": recommended_tile,
    }
