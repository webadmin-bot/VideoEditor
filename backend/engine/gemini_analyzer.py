import os
import json
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List
import logging

from ..config import GEMINI_API_KEY
from .video_inspector import inspect_video_file

logger = logging.getLogger("ai_video_studio.gemini_analyzer")

def analyze_visual_context_and_moments(
    video_path: str,
    temp_dir: str,
    transcript_summary: str = ""
) -> Dict[str, Any]:
    """
    Analyzes actual representative video frames using Google Gemini API.
    Extracts real frames based on actual video duration, passes the image bytes
    to Gemini 3.8 Flash, and returns genuine observations with exact frame timestamps.
    Always cleans up temporary frames even if Gemini analysis fails.
    """
    if not GEMINI_API_KEY:
        return {
            "enabled": False,
            "available": False,
            "message": "Gemini API key is not configured in .env. Visual AI scene analysis is unavailable.",
            "analysis_text": "Scene analysis unavailable (Gemini API key missing).",
            "visual_highlights": [],
            "scene_tags": []
        }

    ffmpeg = shutil.which("ffmpeg")
    in_path = Path(video_path)
    if not ffmpeg or not in_path.exists():
        return {
            "enabled": False,
            "available": False,
            "message": f"Video file or FFmpeg executable not found: {video_path}",
            "analysis_text": "Scene analysis unavailable (Video or FFmpeg not found).",
            "visual_highlights": [],
            "scene_tags": []
        }

    frames_dir = Path(temp_dir) / f"gemini_frames_{os.getpid()}"
    extracted_items = []

    try:
        # Get actual video duration from FFprobe
        meta = inspect_video_file(str(in_path.resolve()))
        duration = float(meta.get("duration_seconds", 0.0))
        if duration <= 0.0:
            return {
                "enabled": False,
                "available": False,
                "message": "Selected video has invalid or zero duration.",
                "analysis_text": "Scene analysis unavailable (Zero duration).",
                "visual_highlights": [],
                "scene_tags": []
            }

        # Calculate exact frame timestamps guaranteed to be strictly within actual video duration
        if duration < 1.0:
            sample_percentages = [0.5]
        elif duration < 4.0:
            sample_percentages = [0.25, 0.75]
        else:
            sample_percentages = [0.20, 0.50, 0.80]

        target_timestamps = [
            min(max(0.0, round(duration * p, 2)), max(0.05, duration - 0.05))
            for p in sample_percentages
        ]

        frames_dir.mkdir(parents=True, exist_ok=True)

        for i, ts in enumerate(target_timestamps):
            out_frame = frames_dir / f"frame_{i}_{ts}s.jpg"
            cmd = [
                ffmpeg, "-y",
                "-ss", str(ts),
                "-i", str(in_path.resolve()),
                "-vframes", "1",
                "-vf", "scale=640:-1",
                "-q:v", "2",
                str(out_frame)
            ]
            res = subprocess.run(cmd, capture_output=True, timeout=12)
            if res.returncode == 0 and out_frame.exists() and out_frame.stat().st_size > 0:
                extracted_items.append({
                    "timestamp": ts,
                    "path": out_frame,
                    "bytes": out_frame.read_bytes()
                })

        if not extracted_items:
            return {
                "enabled": False,
                "available": False,
                "message": "Could not extract representative video frames from the selected video.",
                "analysis_text": "Scene analysis unavailable (Frame extraction failed).",
                "visual_highlights": [],
                "scene_tags": []
            }

        # Call Gemini SDK with actual image parts
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)

        contents = [
            "You are a professional video director and visual scene analyzer.\n"
            "Carefully analyze the actual representative frame images attached below from this video project.\n"
            f"Actual Video Duration: {duration:.2f} seconds.\n"
            f"Accompanying Speech Transcript Summary: '{transcript_summary or 'No dialogue'}'\n\n"
            "INSTRUCTIONS:\n"
            "1. Base your scene tags and visual highlights SOLELY on what is visibly present in the attached frame images.\n"
            "2. Never invent scenes, objects, or timestamps not present in the frames.\n"
            "3. For visual_highlights, create an entry for the analyzed frames using their exact timestamp number.\n"
            "4. Return ONLY a valid JSON object matching this schema:\n"
            "{\n"
            '  "analysis_text": "Concise paragraph summarizing the observed visual setting and lighting",\n'
            '  "scene_tags": ["tag1", "tag2", "tag3"],\n'
            '  "visual_highlights": [\n'
            '    {"timestamp": 0.0, "title": "Short descriptive title", "description": "What is physically visible in this frame"}\n'
            "  ]\n"
            "}"
        ]

        for item in extracted_items:
            ts = item["timestamp"]
            contents.append(f"Frame extracted at timestamp: {ts} seconds")
            contents.append(types.Part.from_bytes(data=item["bytes"], mime_type="image/jpeg"))

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=contents
        )

        resp_text = response.text or ""
        cleaned_json = resp_text.replace("```json", "").replace("```", "").strip()

        try:
            parsed = json.loads(cleaned_json)
            scene_tags = [str(t) for t in parsed.get("scene_tags", []) if isinstance(t, str)]
            raw_highlights = parsed.get("visual_highlights", [])
            valid_highlights = []
            for h in raw_highlights:
                if isinstance(h, dict) and "timestamp" in h:
                    try:
                        valid_highlights.append({
                            "timestamp": float(h["timestamp"]),
                            "title": str(h.get("title", f"Frame at {h['timestamp']}s")),
                            "description": str(h.get("description", ""))
                        })
                    except (ValueError, TypeError):
                        pass

            return {
                "enabled": True,
                "available": True,
                "analysis_text": parsed.get("analysis_text", "Visual analysis completed."),
                "scene_tags": scene_tags,
                "visual_highlights": valid_highlights,
                "analyzed_timestamps": [item["timestamp"] for item in extracted_items]
            }
        except Exception:
            return {
                "enabled": True,
                "available": True,
                "analysis_text": resp_text,
                "scene_tags": [],
                "visual_highlights": [],
                "analyzed_timestamps": [item["timestamp"] for item in extracted_items]
            }

    except Exception as e:
        logger.error(f"Gemini scene analysis error: {e}")
        return {
            "enabled": False,
            "available": False,
            "message": f"Gemini Vision API error: {str(e)}",
            "analysis_text": f"Scene analysis unavailable ({str(e)}).",
            "visual_highlights": [],
            "scene_tags": []
        }

    finally:
        # Always clean up all extracted temporary frames even if Gemini analysis fails
        if frames_dir.exists():
            shutil.rmtree(frames_dir, ignore_errors=True)
