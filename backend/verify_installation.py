#!/usr/bin/env python3
"""
AI Video Studio — Installation and Hardware Verification Script
Tests PyTorch CUDA 12.8, actual CUDA tensor execution, NVIDIA driver compatibility,
FFmpeg NVENC live initialization test encodes, Real-ESRGAN model weights, and AI subsystems.
"""

import sys
import os
import subprocess
import shutil
import re
from pathlib import Path

def print_header(title: str):
    print("\n" + "=" * 65)
    print(f"  {title.upper()}")
    print("=" * 65)

def check_python():
    print(f"[1/5] Python Environment:")
    print(f"  • Version: {sys.version.split()[0]} ({sys.platform})")
    print(f"  • Executable: {sys.executable}")
    if sys.version_info < (3, 10):
        print("  [WARN] Python 3.10+ is recommended.")
    else:
        print("  [OK] Python version compatible.")

def check_pytorch_cuda():
    print_header("PyTorch & CUDA 12.8 / RTX 5060 Verification")
    try:
        import torch
        print(f"  • PyTorch Version: {torch.__version__}")
        print(f"  • PyTorch CUDA Build Version: {torch.version.cuda or 'None (CPU Wheel)'}")

        cuda_available = torch.cuda.is_available()
        print(f"  • CUDA Available: {cuda_available}")

        if not cuda_available:
            print("\n  [INFO] CUDA is NOT available in this environment.")
            print("  [INFO] The engine will run using CPU processing.")
            print("  • Note: RTX 5060 GPU acceleration requires physical Windows/Linux host")
            print("    with NVIDIA Driver 570+ and CUDA 12.8 wheel installed.")
            return False, "CPU"

        # Check devices
        device_count = torch.cuda.device_count()
        gpu_name = torch.cuda.get_device_name(0)
        capability = torch.cuda.get_device_capability(0)
        print(f"  • Detected GPU: {gpu_name} (Total GPUs: {device_count})")
        print(f"  • Compute Capability: sm_{capability[0]}{capability[1]}")

        # Live CUDA Tensor Execution Test
        print("\n  Running live CUDA tensor computation test...")
        try:
            a = torch.ones((128, 128), device="cuda", dtype=torch.float32) * 2.0
            b = torch.ones((128, 128), device="cuda", dtype=torch.float32) * 3.0
            c = torch.matmul(a, b)
            torch.cuda.synchronize()
            result_val = c[0, 0].item()
            expected_val = 128 * 6.0
            if abs(result_val - expected_val) < 1e-3:
                print(f"  [PASS] CUDA Tensor Execution Test Succeeded! Result: {result_val:.1f}")
            else:
                print(f"  [FAIL] CUDA Tensor math mismatch. Expected {expected_val}, got {result_val}")
                return False, gpu_name
        except Exception as e:
            print(f"  [FAIL] CUDA Tensor execution error: {e}")
            return False, gpu_name

        # Check NVIDIA Driver Version via nvidia-smi
        print("\n  Checking NVIDIA Driver Compatibility...")
        try:
            smi_output = subprocess.check_output(["nvidia-smi"], stderr=subprocess.STDOUT, text=True, timeout=5)
            match = re.search(r"Driver Version:\s*([0-9]+\.[0-9]+)", smi_output)
            if match:
                driver_ver_str = match.group(1)
                driver_major = float(driver_ver_str.split(".")[0])
                print(f"  • Detected Driver Version: {driver_ver_str}")
                if "5060" in gpu_name or capability[0] >= 12:
                    if driver_major < 570:
                        print("  [WARNING] RTX 5060 (Blackwell sm_120) requires NVIDIA Driver >= 570.")
                        print("  [ACTION] Please update your GeForce drivers from:")
                        print("           https://www.nvidia.com/Download/index.aspx")
                    else:
                        print(f"  [PASS] Driver version {driver_ver_str} fully supports RTX 5060 (Blackwell).")
                else:
                    print(f"  [OK] Driver version {driver_ver_str} installed.")
            else:
                print("  [INFO] Could not parse driver version from nvidia-smi.")
        except Exception as e:
            print(f"  [INFO] nvidia-smi not queried: {e}")

        return True, gpu_name

    except ImportError:
        print("  [ERROR] PyTorch is not installed.")
        print("  [ACTION] Run: pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128")
        return False, "Not Installed"

def check_ffmpeg_nvenc():
    print_header("FFmpeg & NVENC Live Initialization Test")
    ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
    try:
        res = subprocess.run([ffmpeg_bin, "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode == 0:
            first_line = res.stdout.splitlines()[0] if res.stdout.splitlines() else "FFmpeg"
            print(f"  • FFmpeg Binary: {ffmpeg_bin} ({first_line})")
        else:
            print("  [FAIL] FFmpeg returned non-zero on -version.")
            return []
    except FileNotFoundError:
        print("  [FAIL] FFmpeg is not installed or not in system PATH.")
        print("  [ACTION] Install FFmpeg with NVENC support (e.g., via winget install Gyan.FFmpeg or scoop).")
        return []

    encoders_to_test = ["h264_nvenc", "hevc_nvenc", "av1_nvenc"]
    verified = []

    print("\n  Testing NVENC hardware encoders with live 0.1s test encode:")
    for enc in encoders_to_test:
        cmd = [
            ffmpeg_bin, "-y",
            "-f", "lavfi", "-i", "color=c=black:s=64x64:d=0.1",
            "-c:v", enc,
            "-f", "null", "-"
        ]
        try:
            enc_res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=6)
            if enc_res.returncode == 0:
                print(f"  [PASS] {enc:<12} : INITIALIZATION SUCCEEDED (Active)")
                verified.append(enc)
            else:
                err_snippet = enc_res.stderr.strip().splitlines()[-1] if enc_res.stderr.strip() else "Error"
                print(f"  [SKIP] {enc:<12} : Initialization failed ({err_snippet[:45]}...)")
        except Exception as e:
            print(f"  [SKIP] {enc:<12} : Exception ({e})")

    # Verify software fallback encoder libx264
    cmd_x264 = [
        ffmpeg_bin, "-y",
        "-f", "lavfi", "-i", "color=c=black:s=64x64:d=0.1",
        "-c:v", "libx264",
        "-f", "null", "-"
    ]
    try:
        x264_res = subprocess.run(cmd_x264, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=6)
        if x264_res.returncode == 0:
            print(f"  [PASS] {'libx264':<12} : INITIALIZATION SUCCEEDED (Software Fallback Ready)")
            verified.append("libx264")
        else:
            print(f"  [WARN] {'libx264':<12} : Initialization failed")
    except Exception as e:
        print(f"  [WARN] {'libx264':<12} : Exception ({e})")

    return verified

def check_ai_subsystems():
    print_header("AI Subsystems & Model Weights Status")

    # 1. Faster-Whisper
    try:
        import faster_whisper
        print(f"  • Faster-Whisper : Installed (v{getattr(faster_whisper, '__version__', 'unknown')})")
    except ImportError:
        print("  • Faster-Whisper : Not installed (Run 'pip install faster-whisper')")

    # 2. Real-ESRGAN Packages & Model Weights
    models_dir = Path("storage/models/realesrgan")
    models_dir.mkdir(parents=True, exist_ok=True)
    
    weights_x4 = models_dir / "RealESRGAN_x4plus.pth"
    weights_x2 = models_dir / "RealESRGAN_x2plus.pth"
    
    has_x4 = weights_x4.exists() and weights_x4.stat().st_size > 1024 * 1024
    has_x2 = weights_x2.exists() and weights_x2.stat().st_size > 1024 * 1024

    realesrgan_pkg = False
    try:
        import realesrgan
        from realesrgan import RealESRGANer
        from basicsr.archs.rrdbnet_arch import RRDBNet
        realesrgan_pkg = True
        print(f"  • Real-ESRGAN   : Package Installed")
    except ImportError:
        print("  • Real-ESRGAN   : Package Not Installed (Run 'pip install realesrgan')")

    if has_x4 or has_x2:
        found = []
        if has_x4: found.append(f"RealESRGAN_x4plus.pth ({round(weights_x4.stat().st_size / (1024*1024), 1)} MB)")
        if has_x2: found.append(f"RealESRGAN_x2plus.pth ({round(weights_x2.stat().st_size / (1024*1024), 1)} MB)")
        print(f"  • Weights Status: Available in {models_dir} ({', '.join(found)})")
    else:
        print(f"  • Weights Status: Missing weights in {models_dir}")
        print("    [NOTICE] To enable neural upscaling, download:")
        print("             https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth")
        print(f"             and place into: {models_dir.resolve()}/")

    # Test Live Inference if package and weights present
    if realesrgan_pkg and (has_x4 or has_x2):
        print("\n  Testing Real-ESRGAN Inference with synthetic test image...")
        try:
            import torch
            import numpy as np
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model_file = weights_x4 if has_x4 else weights_x2
            scale = 4 if has_x4 else 2
            
            model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=scale)
            upsampler = RealESRGANer(
                scale=scale,
                model_path=str(model_file),
                model=model,
                tile=256,
                tile_pad=10,
                pre_pad=0,
                half=(device == "cuda"),
                device=torch.device(device)
            )
            dummy = np.zeros((32, 32, 3), dtype=np.uint8)
            dummy[8:24, 8:24, :] = 255
            out, _ = upsampler.enhance(dummy, outscale=scale)
            print(f"  [PASS] Real-ESRGAN Test Inference Succeeded on {device.upper()}! Output shape: {out.shape}")
        except Exception as e:
            print(f"  [FAIL] Real-ESRGAN inference test failed: {e}")

    # 3. Google GenAI SDK
    try:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY", "")
        key_status = "Configured" if api_key else "Missing GEMINI_API_KEY in .env"
        print(f"  • Google GenAI  : Installed ({key_status})")
    except ImportError:
        print("  • Google GenAI  : Not installed")

def main():
    print("=" * 65)
    print("      AI VIDEO STUDIO — ENVIRONMENT & HARDWARE VERIFICATION")
    print("=" * 65)

    check_python()
    cuda_ok, gpu_name = check_pytorch_cuda()
    verified_encoders = check_ffmpeg_nvenc()
    check_ai_subsystems()

    print_header("Verification Summary")
    print(f"  • Device Mode        : {'GPU Accelerated (' + gpu_name + ')' if cuda_ok else 'CPU Processing'}")
    print(f"  • Verified Encoders  : {', '.join(verified_encoders) if verified_encoders else 'None'}")
    if any("nvenc" in e for e in verified_encoders):
        print("  • Primary Encoder    : NVENC Hardware Accelerated")
    else:
        print("  • Primary Encoder    : libx264 (Software CPU Fallback)")
    print("=" * 65)
    print("Verification complete.\n")

if __name__ == "__main__":
    main()
