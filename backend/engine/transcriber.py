import shutil
import subprocess
import os
from pathlib import Path
from typing import List, Dict, Any, Optional

def extract_audio_wav(video_path: str, output_wav_path: str) -> bool:
    """Extracts 16kHz mono PCM WAV for Whisper analysis."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False

    cmd = [
        ffmpeg,
        "-y",
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_wav_path)
    ]
    res = subprocess.run(cmd, capture_output=True)
    return res.returncode == 0 and Path(output_wav_path).exists()

def transcribe_audio_words(
    video_path: str,
    temp_dir: str,
    model_size: str = "base",
    language: Optional[str] = None
) -> Dict[str, Any]:
    """
    Transcribes audio using Faster-Whisper with word-level timestamps.
    Falls back gracefully if faster-whisper package or CUDA is not installed.
    """
    v_path = Path(video_path)
    if not v_path.exists():
        raise FileNotFoundError(f"Video file {video_path} does not exist.")

    wav_path = Path(temp_dir) / f"{v_path.stem}_audio_16k.wav"
    audio_extracted = extract_audio_wav(str(v_path), str(wav_path))

    words_result: List[Dict[str, Any]] = []
    segments_result: List[Dict[str, Any]] = []
    detected_language = "en"
    engine_used = "faster-whisper"

    try:
        from faster_whisper import WhisperModel
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"

        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        input_audio = str(wav_path) if audio_extracted else str(v_path)
        
        segments, info = model.transcribe(
            input_audio,
            word_timestamps=True,
            language=language
        )
        detected_language = info.language

        seg_idx = 1
        word_idx = 1
        for seg in segments:
            seg_words = []
            if seg.words:
                for w in seg.words:
                    word_obj = {
                        "id": f"w-{word_idx}",
                        "word": w.word.strip(),
                        "start": round(w.start, 2),
                        "end": round(w.end, 2),
                        "confidence": round(w.probability, 2)
                    }
                    seg_words.append(word_obj)
                    words_result.append(word_obj)
                    word_idx += 1

            segments_result.append({
                "id": f"seg-{seg_idx}",
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
                "words": seg_words
            })
            seg_idx += 1

    except ImportError:
        engine_used = "diagnostic-fallback"
        # When faster-whisper is not installed yet on Windows system
        # return sample/diagnostic segments so user can test the kinetic subtitle editor immediately
        segments_result = [
            {
                "id": "seg-1",
                "start": 0.5,
                "end": 2.8,
                "text": "Welcome to AI Video Studio local engine.",
                "words": [
                    {"id": "w-1", "word": "Welcome", "start": 0.5, "end": 0.9, "confidence": 0.98},
                    {"id": "w-2", "word": "to", "start": 1.0, "end": 1.2, "confidence": 0.99},
                    {"id": "w-3", "word": "AI", "start": 1.3, "end": 1.6, "confidence": 0.95},
                    {"id": "w-4", "word": "Video", "start": 1.7, "end": 2.0, "confidence": 0.97},
                    {"id": "w-5", "word": "Studio", "start": 2.1, "end": 2.4, "confidence": 0.96},
                    {"id": "w-6", "word": "local", "start": 2.45, "end": 2.65, "confidence": 0.94},
                    {"id": "w-7", "word": "engine.", "start": 2.68, "end": 2.8, "confidence": 0.95},
                ]
            },
            {
                "id": "seg-2",
                "start": 3.2,
                "end": 5.4,
                "text": "High precision kinetic subtitles and upscaling.",
                "words": [
                    {"id": "w-8", "word": "High", "start": 3.2, "end": 3.5, "confidence": 0.96},
                    {"id": "w-9", "word": "precision", "start": 3.55, "end": 4.0, "confidence": 0.98},
                    {"id": "w-10", "word": "kinetic", "start": 4.05, "end": 4.5, "confidence": 0.97},
                    {"id": "w-11", "word": "subtitles", "start": 4.55, "end": 4.9, "confidence": 0.99},
                    {"id": "w-12", "word": "and", "start": 4.95, "end": 5.1, "confidence": 0.98},
                    {"id": "w-13", "word": "upscaling.", "start": 5.15, "end": 5.4, "confidence": 0.97},
                ]
            }
        ]
        words_result = [w for s in segments_result for w in s["words"]]
    finally:
        if wav_path.exists():
            try:
                os.remove(wav_path)
            except Exception:
                pass

    return {
        "engine": engine_used,
        "language": detected_language,
        "total_words": len(words_result),
        "total_segments": len(segments_result),
        "segments": segments_result,
        "words": words_result,
    }
