from pathlib import Path
from typing import List, Dict, Any

def hex_to_ass_color(hex_str: str, alpha_hex: str = "00") -> str:
    """Converts #RRGGBB to ASS &H00BBGGRR&."""
    clean = hex_str.replace("#", "").strip()
    if len(clean) == 6:
        r, g, b = clean[0:2], clean[2:4], clean[4:6]
    elif len(clean) == 3:
        r, g, b = clean[0]*2, clean[1]*2, clean[2]*2
    else:
        r, g, b = "FF", "FF", "FF"
    return f"&H{alpha_hex}{b}{g}{r}&".upper()

def format_ass_time(seconds: float) -> str:
    """Formats seconds to H:MM:SS.cc"""
    safe_sec = max(0.0, seconds)
    total_cs = round(safe_sec * 100)
    cs = total_cs % 100
    total_secs = total_cs // 100
    secs = total_secs % 60
    mins = (total_secs // 60) % 60
    hrs = total_secs // 3600
    return f"{hrs}:{mins:02d}:{secs:02d}.{cs:02d}"

def format_srt_time(seconds: float) -> str:
    """Formats seconds to HH:MM:SS,mmm"""
    safe_sec = max(0.0, seconds)
    total_ms = round(safe_sec * 1000)
    ms = total_ms % 1000
    total_secs = total_ms // 1000
    secs = total_secs % 60
    mins = (total_secs // 60) % 60
    hrs = total_secs // 3600
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"

def generate_ass_file(
    segments: List[Dict[str, Any]],
    style_config: Dict[str, Any],
    output_path: str,
    video_width: int = 1920,
    video_height: int = 1080
) -> str:
    """Generates an Advanced SubStation Alpha (.ass) file with kinetic typography."""
    mode = style_config.get("mode", "kinetic-word")
    font_family = style_config.get("fontFamily", "Montserrat").split(",")[0].strip()
    font_size = style_config.get("fontSize", 32)
    font_weight = style_config.get("fontWeight", "800")
    is_bold = 1 if font_weight in ["bold", "800", "900"] else 0
    text_color = style_config.get("textColor", "#FFFFFF")
    highlight_color = style_config.get("highlightColor", "#F59E0B")
    outline_color = style_config.get("outlineColor", "#000000")
    outline_width = style_config.get("outlineWidth", 3)
    shadow_depth = style_config.get("shadowDepth", 2)
    position = style_config.get("position", "bottom")
    vertical_margin = style_config.get("verticalMargin", 60)
    pop_anim = style_config.get("popAnimation", True)
    glow_effect = style_config.get("glowEffect", True)
    anim_duration = style_config.get("animationDurationMs", 120)

    primary_color = hex_to_ass_color(text_color)
    highlight_ass = hex_to_ass_color(highlight_color)
    outline_ass = hex_to_ass_color(outline_color)
    back_ass = hex_to_ass_color("#000000", "50")

    alignment = 2  # Bottom center
    if position == "center":
        alignment = 5
    elif position == "top":
        alignment = 8

    content = f"""[Script Info]
Title: AI Video Studio Kinetic Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {video_width}
PlayResY: {video_height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_family},{font_size},{primary_color},{highlight_ass},{outline_ass},{back_ass},{is_bold},0,0,0,100,100,0,0,1,{outline_width},{shadow_depth},{alignment},40,40,{vertical_margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogue_lines: List[str] = []

    for seg in segments:
        text = seg.get("text", "").strip()
        words = seg.get("words", [])
        if not text:
            continue

        if mode == "kinetic-word" and words:
            # Mode A: Word-by-word kinetic typography with pop/highlight
            for i, curr_w in enumerate(words):
                w_start = format_ass_time(float(curr_w.get("start", 0)))
                w_end = format_ass_time(float(curr_w.get("end", 0)))
                
                parts = []
                for j, w in enumerate(words):
                    word_str = w.get("word", "")
                    if j == i:
                        pop_tag = f"{{\\t(0,{anim_duration},\\fscx115\\fscy115)\\t({anim_duration},{anim_duration*2},\\fscx100\\fscy100)}}" if pop_anim else ""
                        glow_tag = "{\\blur3}" if glow_effect else ""
                        parts.append(f"{{\\c{highlight_ass}}}{pop_tag}{glow_tag}{word_str}{{\\r}}")
                    else:
                        parts.append(f"{{\\c{primary_color}}}{word_str}")

                line_text = " ".join(parts)
                dialogue_lines.append(f"Dialogue: 0,{w_start},{w_end},Default,,0,0,0,,{line_text}")
        else:
            # Mode B: Cinematic phrase with fade
            start = format_ass_time(float(seg.get("start", 0)))
            end = format_ass_time(float(seg.get("end", 0)))
            clean_text = text.replace("\n", "\\N")
            dialogue_lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{{\\fad(200,200)}}{clean_text}")

    full_ass = content + "\n".join(dialogue_lines) + "\n"
    
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(full_ass, encoding="utf-8")
    return str(out_file)

def generate_srt_file(segments: List[Dict[str, Any]], output_path: str) -> str:
    """Generates a standard .srt subtitle file."""
    lines: List[str] = []
    idx = 1
    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue
        start = format_srt_time(float(seg.get("start", 0)))
        end = format_srt_time(float(seg.get("end", 0)))
        lines.append(f"{idx}\n{start} --> {end}\n{text}\n")
        idx += 1

    full_srt = "\n".join(lines)
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(full_srt, encoding="utf-8")
    return str(out_file)
