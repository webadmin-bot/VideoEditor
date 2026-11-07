import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List

def transcribe_audio_words(video_path: str, temp_dir: str, model_size: str = "base") -> Dict[str, Any]:
    """
    Extracts audio from video and transcribes using Faster-Whisper with word-level timestamps.
    Raises real processing errors if FFmpeg or Faster-Whisper fails.
    Never returns fake or demonstration transcript words.
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

    # 1. Extract 16kHz mono audio track
    extract_cmd = [
        ffmpeg, "-y",
        "-i", str(video_file.resolve()),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(audio_path.resolve())
    ]

    res = subprocess.run(extract_cmd, capture_output=True, text=True, timeout=60)
    if res.returncode != 0 or not audio_path.exists() or audio_path.stat().st_size == 0:
        err = res.stderr.strip() or "Audio extraction failed"
        raise RuntimeError(f"FFmpeg failed to extract audio from video: {err}")

    # 2. Run Faster-Whisper
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        if audio_path.exists():
            audio_path.unlink()
        raise RuntimeError(
            "Faster-Whisper is not installed. Please run INSTALL.bat or 'pip install faster-whisper' to enable speech recognition."
        )

    words_list: List[Dict[str, Any]] = []
    segments_list: List[Dict[str, Any]] = []

    try:
        # Determine optimal device (CUDA GPU if available, else CPU)
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
    except Exception:
        device = "cpu"
        compute_type = "int8"

    try:
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        segments_gen, info = model.transcribe(str(audio_path.resolve()), word_timestamps=True)

        w_id = 1
        for s_idx, seg in enumerate(segments_gen):
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

        detected_lang = getattr(info, "language", "en")
    finally:
        # Always clean temporary extracted audio file
        if audio_path.exists():
            try:
                audio_path.unlink()
            except Exception:
                pass

    return {
        "engine": "faster-whisper",
        "language": detected_lang,
        "total_words": len(words_list),
        "total_segments": len(segments_list),
        "segments": segments_list,
        "words": words_list
    }
