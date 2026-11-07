import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger("ai_video_studio.transcriber")

def verify_ctranslate2_device() -> tuple[str, str, Optional[str]]:
    """
    Verifies CTranslate2 CUDA support independently of PyTorch.
    Tests device availability and verified compute types.
    Returns (device, compute_type, gpu_error).
    """
    try:
        import ctranslate2
        cuda_count = ctranslate2.get_cuda_device_count()
        if cuda_count > 0:
            # Check supported compute type on CUDA
            compute_type = "int8"
            for c_candidate in ["float16", "int8_float16", "bfloat16"]:
                try:
                    if ctranslate2.models.Whisper.is_compute_type_supported("cuda", c_candidate):
                        compute_type = c_candidate
                        break
                except Exception:
                    continue
            return "cuda", compute_type, None
        else:
            return "cpu", "int8", "CTranslate2 reports 0 CUDA devices available on this host."
    except Exception as e:
        return "cpu", "int8", f"CTranslate2 CUDA verification failed: {e}"

def transcribe_audio_words(
    video_path: str,
    temp_dir: str,
    model_size: str = "base",
    job_ref: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Extracts audio from video and transcribes using Faster-Whisper with word-level timestamps.
    Never fabricates progress percentages or demonstration words.
    Verifies CTranslate2 CUDA support independently of PyTorch and falls back to CPU only when necessary,
    recording the genuine execution device and GPU errors.
    """
    video_file = Path(video_path)
    if not video_file.exists():
        raise FileNotFoundError(f"Video file not found for transcription: {video_path}")

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg executable not found on system PATH. Audio extraction failed.")

    temp_path = Path(temp_dir)
    temp_path.mkdir(parents=True, exist_ok=True)
    audio_path = temp_path / f"audio_{video_file.stem}_{os.getpid()}.wav"

    if job_ref and hasattr(job_ref, "update"):
        job_ref.update("EXTRACTING_AUDIO", 0.0, "Extracting audio track for transcription")

    # 1. Extract 16kHz mono audio track using FFmpeg
    extract_cmd = [
        ffmpeg, "-y",
        "-i", str(video_file.resolve()),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(audio_path.resolve())
    ]

    extract_proc = subprocess.Popen(extract_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if job_ref and hasattr(job_ref, "set_process"):
        job_ref.set_process(extract_proc)

    _, stderr_text = extract_proc.communicate()

    if job_ref and getattr(job_ref, "cancelled", False):
        if audio_path.exists():
            audio_path.unlink()
        raise RuntimeError("Transcription cancelled by user.")

    if extract_proc.returncode != 0 or not audio_path.exists() or audio_path.stat().st_size == 0:
        if audio_path.exists():
            audio_path.unlink()
        err = stderr_text.strip() or "Audio extraction failed"
        raise RuntimeError(f"FFmpeg failed to extract audio from video: {err}")

    # 2. Faster-Whisper setup
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        if audio_path.exists():
            audio_path.unlink()
        raise RuntimeError(
            "Faster-Whisper is not installed. Please run INSTALL.bat or 'pip install faster-whisper' to enable speech recognition."
        )

    # 3. Independent CTranslate2 CUDA check & model initialization
    target_device, target_compute_type, initial_gpu_error = verify_ctranslate2_device()
    actual_device = target_device
    actual_compute_type = target_compute_type
    gpu_error = initial_gpu_error

    if job_ref and hasattr(job_ref, "update"):
        job_ref.update("LOADING_MODEL", 0.0, f"Loading Faster-Whisper ({model_size}) on {target_device.upper()} ({target_compute_type})")

    if job_ref and getattr(job_ref, "cancelled", False):
        if audio_path.exists():
            audio_path.unlink()
        raise RuntimeError("Transcription cancelled by user.")

    # Initialize model with graceful GPU->CPU fallback reporting
    try:
        model = WhisperModel(model_size, device=target_device, compute_type=target_compute_type)
    except Exception as e:
        if target_device == "cuda":
            gpu_error = f"Faster-Whisper CUDA initialization failed: {e}. Falling back to CPU."
            logger.warning(gpu_error)
            actual_device = "cpu"
            actual_compute_type = "int8"
            if job_ref and hasattr(job_ref, "update"):
                job_ref.update("LOADING_MODEL", 0.0, f"Falling back to CPU: {gpu_error[:80]}")
            model = WhisperModel(model_size, device="cpu", compute_type="int8")
        else:
            if audio_path.exists():
                audio_path.unlink()
            raise RuntimeError(f"Whisper model loading failed: {e}")

    words_list: List[Dict[str, Any]] = []
    segments_list: List[Dict[str, Any]] = []

    try:
        if job_ref and hasattr(job_ref, "update"):
            job_ref.update("TRANSCRIBING", 0.0, f"Transcribing speech using {actual_device.upper()} ({actual_compute_type})")

        segments_gen, info = model.transcribe(str(audio_path.resolve()), word_timestamps=True)

        w_id = 1
        for s_idx, seg in enumerate(segments_gen):
            if job_ref and getattr(job_ref, "cancelled", False):
                raise RuntimeError("Transcription cancelled by user.")

            seg_words = []
            if hasattr(seg, "words") and seg.words:
                for w in seg.words:
                    word_obj = {
                        "id": f"w-{w_id}",
                        "word": w.word.strip(),
                        "start": round(float(w.start), 2),
                        "end": round(float(w.end), 2),
                        "confidence": round(float(getattr(w, "probability", 0.95)), 2)
                    }
                    seg_words.append(word_obj)
                    words_list.append(word_obj)
                    w_id += 1

            segments_list.append({
                "id": f"seg-{s_idx + 1}",
                "start": round(float(seg.start), 2),
                "end": round(float(seg.end), 2),
                "text": seg.text.strip(),
                "words": seg_words
            })

            if job_ref and hasattr(job_ref, "update"):
                job_ref.update("TRANSCRIBING", 0.0, f"Transcribed segment {s_idx + 1} ({round(seg.end, 1)}s) [{actual_device.upper()}]")

        detected_lang = getattr(info, "language", "en")
    finally:
        if audio_path.exists():
            try:
                audio_path.unlink()
            except Exception:
                pass

    return {
        "engine": "faster-whisper",
        "device_used": actual_device,
        "compute_type": actual_compute_type,
        "gpu_error": gpu_error,
        "language": detected_lang,
        "total_words": len(words_list),
        "total_segments": len(segments_list),
        "segments": segments_list,
        "words": words_list
    }
