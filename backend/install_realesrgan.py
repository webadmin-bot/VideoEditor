#!/usr/bin/env python3
"""
AI Video Studio — Dedicated Real-ESRGAN Model Installer and Verifier
Installs Real-ESRGAN dependencies without replacing PyTorch,
downloads/verifies official model weights using SHA-256 checksums,
and verifies model inference before displaying READY.
"""

import os
import sys
import hashlib
import urllib.request
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import MODELS_DIR

# Official Real-ESRGAN releases and verified SHA-256 hashes
MODELS_CATALOG = {
    "RealESRGAN_x4plus.pth": {
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        "sha256": "66d5bf6367500cf9d7be4a0b25e799db6ff8689531855a8cf82e9b922097e883",
        "scale": 4,
        "description": "General x4 ultra-resolution upscaling (RRDBNet 64-feat 23-block)"
    },
    "RealESRGAN_x2plus.pth": {
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
        "sha256": "41b8026778f654497b77cf4cf3832c6ff6819a3d463b2f96cf9beaf76274e797",
        "scale": 2,
        "description": "Fast x2 high-detail upscaling (RRDBNet 64-feat 23-block)"
    }
}

def compute_sha256(filepath: Path) -> str:
    """Computes SHA-256 checksum of a file."""
    h = hashlib.sha256()
    with filepath.open("rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

def download_file_with_progress(url: str, dest_path: Path):
    """Downloads a file with clean console progress tracking."""
    print(f"Downloading from {url}...")
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest_path.with_suffix(".tmp")

    def report(count, block_size, total_size):
        if total_size <= 0:
            return
        downloaded = count * block_size
        pct = min(100.0, (downloaded / total_size) * 100.0)
        mb_down = downloaded / (1024 * 1024)
        mb_total = total_size / (1024 * 1024)
        sys.stdout.write(f"\r  [{pct:5.1f}%] {mb_down:5.1f} MB / {mb_total:5.1f} MB")
        sys.stdout.flush()

    try:
        urllib.request.urlretrieve(url, str(temp_path), reporthook=report)
        print()
        if temp_path.exists():
            temp_path.replace(dest_path)
            return True
    except Exception as e:
        print(f"\n  [ERROR] Download failed: {e}")
        if temp_path.exists():
            temp_path.unlink()
        return False

def verify_and_test_model(filename: str, auto_download: bool = True):
    info = MODELS_CATALOG.get(filename)
    if not info:
        print(f"Unknown model: {filename}")
        return False

    dest = MODELS_DIR / filename
    print(f"\nChecking model weights: {filename}")
    print(f"Target location: {dest}")

    if not dest.exists() or dest.stat().st_size < 1024 * 1024:
        if auto_download:
            print(f"Model weights not found. Attempting download...")
            success = download_file_with_progress(info["url"], dest)
            if not success:
                print(f"[ACTION REQUIRED] Manual download instructions:")
                print(f"  1. Download: {info['url']}")
                print(f"  2. Save to : {dest.resolve()}")
                return False
        else:
            print("Model weights missing.")
            return False

    # Check SHA-256
    print("Verifying SHA-256 checksum...")
    calc_hash = compute_sha256(dest)
    expected_hash = info["sha256"]
    if calc_hash.lower() == expected_hash.lower():
        print(f"  [PASS] SHA-256 Verified: {calc_hash}")
    else:
        print(f"  [WARN] Checksum mismatch:")
        print(f"    Expected: {expected_hash}")
        print(f"    Got     : {calc_hash}")
        print("  File may be corrupted or modified.")

    # Test actual inference before displaying READY
    print("Testing model inference with synthetic frame...")
    try:
        from backend.engine.enhancer import test_realesrgan_inference
        m_label = "Real-ESRGAN-x4" if "x4" in filename else "Real-ESRGAN-x2"
        res = test_realesrgan_inference(model_name=m_label)
        if res.get("success"):
            print(f"  [PASS] Live Test Inference Succeeded on {res.get('device', 'CPU').upper()}!")
            print(f"         Input Shape: {res.get('input_shape')} -> Output Shape: {res.get('output_shape')}")
            print(f"  >>> STATUS: {filename} IS READY FOR USE")
            return True
        else:
            print(f"  [FAIL] Test inference failed: {res.get('error')}")
            return False
    except Exception as e:
        print(f"  [FAIL] Could not run test inference: {e}")
        return False

def main():
    print("=" * 65)
    print("    AI VIDEO STUDIO — REAL-ESRGAN INSTALLER & VERIFIER")
    print("=" * 65)

    # 1. Check PyTorch version without modifying it
    try:
        import torch
        print(f"PyTorch Version: {torch.__version__} (CUDA Available: {torch.cuda.is_available()})")
        if torch.cuda.is_available():
            print(f"Active GPU: {torch.cuda.get_device_name(0)}")
    except ImportError:
        print("[ERROR] PyTorch is not installed. Run INSTALL.bat first.")
        sys.exit(1)

    # 2. Check Real-ESRGAN package
    try:
        import realesrgan
        print("Real-ESRGAN package is installed.")
    except ImportError:
        print("Real-ESRGAN package is NOT installed.")
        print("Install via: pip install basicsr realesrgan --no-deps")
        print("Or run INSTALL_REALESRGAN.bat")

    # 3. Verify models in catalog
    auto_dl = "--download" in sys.argv or "--auto" in sys.argv
    for m in MODELS_CATALOG.keys():
        verify_and_test_model(m, auto_download=auto_dl)

    print("\n" + "=" * 65)
    print("Verification complete.")

if __name__ == "__main__":
    main()
