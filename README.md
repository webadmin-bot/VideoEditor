# AI Video Studio — Local Web Application for Windows

A local, professional video-production studio that runs natively in Google Chrome or Microsoft Edge. Built for content creators, video editors, and AI power users who require GPU-accelerated video enhancement, frame-accurate kinetic typography subtitles, and real-time processing directly on their Windows workstation.

---

## Key Highlights

- **Local Processing**: Processes videos on your local CPU and NVIDIA GPU. Never uploads complete user videos to cloud services.
- **Kinetic Typography Engine**:
  - **Mode A (Word-by-Word Kinetic)**: Synchronized word-level pop, scale, bounce, glow, and highlight effects.
  - **Mode B (Cinematic Phrases)**: Elegant fade-ins, tracking, readable auto-grouping, and safe margins.
- **Whisper Speech Recognition**: Faster-Whisper with word-level timestamp alignment.
- **AI Video Enhancement**:
  - Resolution upscaling (720p to 1080p, 1080p to 2K, 1080p to 4K).
  - Tiled upscaling support for VRAM safety.
  - Professional presets: *Natural*, *Cinematic*, *Sharp and Detailed*, *Clean and Smooth*, and *Custom*.
  - Denoising (hqdn3d), sharpening (unsharp), color balance (eq), and stabilization.
- **Browser File System Access API**:
  - Direct local video selection.
  - Functional **Select Output Folder** (`window.showDirectoryPicker`) saving renders directly to your designated local folder.
- **True FFmpeg Production Pipeline**:
  - High-performance ASS subtitle burning (`ass=subtitles.ass`).
  - NVIDIA Blackwell Gen 9 NVENC hardware acceleration (`av1_nvenc`, `hevc_nvenc`, `h264_nvenc`) with automatic CPU fallback (`libx264`).
  - Exports Final MP4, SRT, ASS, Transcript JSON, and Processing Reports.

---

## Hardware Configuration — NVIDIA GeForce RTX 5060

This studio is optimized for the **NVIDIA GeForce RTX 5060** desktop & mobile GPU based on the **NVIDIA Blackwell Architecture**:

- **Architecture**: Blackwell (sm_100 / sm_120 family with 5th Gen Tensor Cores)
- **Video Encoders**: Gen 9 Dual NVENC supporting **AV1 Hardware Encoding** (`av1_nvenc`), HEVC 10-bit (`hevc_nvenc`), and H.264 (`h264_nvenc`)
- **VRAM Allocation**: Dynamic memory-aware tiled processing (adapts tile sizes from 256px to 1024px depending on free GDDR7 VRAM)
- **CUDA Runtime**: CUDA 12.8 / 12.6 with PyTorch 2.6+
- **Driver Requirement**: NVIDIA Display Driver **570.xx** or newer

---

## System Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Browser**: Google Chrome or Microsoft Edge (Chromium with File System Access API)
- **Processor**: Intel Core i5 / i7 / AMD Ryzen 5 / 7 or better
- **RAM**: 8 GB minimum (16 GB+ recommended for 4K video)
- **GPU (Recommended)**: **NVIDIA GeForce RTX 5060** (or RTX 50-series / 40-series with CUDA support)
- **Storage**: SSD with at least 5 GB free disk space

---

## Quick Start on Windows

### 1. One-Click Setup
Double-click:
```bat
INSTALL.bat
```
This script automatically:
1. Verifies Python 3.10+ and Node.js.
2. Creates a Python virtual environment (`venv`).
3. Installs backend dependencies (`requirements.txt`).
4. Installs frontend packages (`npm install`).
5. Verifies FFmpeg and provides download instructions if missing.

### 2. Start Application
Double-click:
```bat
START_AI_VIDEO_STUDIO.bat
```
The launcher will:
- Check your hardware and NVIDIA GPU CUDA capabilities.
- Start the Python FastAPI backend on `http://127.0.0.1:8000`.
- Start the React Studio frontend on `http://localhost:3000`.
- Automatically launch Google Chrome or Microsoft Edge to your studio workspace.

### 3. Stop Application
To safely terminate all background processes:
```bat
STOP_AI_VIDEO_STUDIO.bat
```

---

## FFmpeg Installation on Windows

If FFmpeg is not already on your system:
1. Download the latest build from [gyan.dev FFmpeg Builds](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip).
2. Extract the archive to `C:\ffmpeg`.
3. Open Windows Start menu, search for **Edit the system environment variables**.
4. Click **Environment Variables**, select `Path` under *System variables*, and click **Edit**.
5. Click **New** and add `C:\ffmpeg\bin`.
6. Click **OK** to save.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Google Chrome / MS Edge   |
                      |  React + TypeScript UI      |
                      |  File System Access API     |
                      +--------------+--------------+
                                     |
                       REST API & WebSockets (Port 8000 / 3000)
                                     |
                      +--------------v--------------+
                      |   Python FastAPI Engine     |
                      |   Hardware Monitor (GPU/CPU)|
                      |   Job Queue State Machine   |
                      +--------------+--------------+
                                     |
      +--------------------+---------+---------+--------------------+
      |                    |                   |                    |
+-----v------+      +------v-----+      +------v-----+       +------v-----+
| FFprobe    |      | Faster-    |      | ASS & SRT  |       | FFmpeg     |
| Stream     |      | Whisper    |      | Subtitle   |       | NVENC/CPU  |
| Inspector  |      | Transcriber|      | Generator  |       | Renderer   |
+------------+      +------------+      +------------+       +------------+
```

---

## License
Apache-2.0
