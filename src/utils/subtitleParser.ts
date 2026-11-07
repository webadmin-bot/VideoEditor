/**
 * Subtitle and Kinetic Typography Parser & Generator
 * Handles SRT, ASS (Advanced SubStation Alpha), and word segmentation.
 */

export interface WordTimestamp {
  id: string;
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
  confidence?: number;
  isEmphasized?: boolean;
}

export interface SubtitleSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
}

export type SubtitleMode = 'kinetic-word' | 'cinematic-phrase';

export interface SubtitleStyleConfig {
  mode: SubtitleMode;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '800' | '900';
  textColor: string;          // Hex e.g. #FFFFFF
  highlightColor: string;     // Hex e.g. #FFD700
  outlineColor: string;       // Hex e.g. #000000
  outlineWidth: number;
  shadowColor: string;        // Hex e.g. #000000
  shadowDepth: number;
  backgroundColor: string;    // Hex e.g. #000000
  backgroundOpacity: number;  // 0 to 1
  position: 'bottom' | 'center' | 'top';
  verticalMargin: number;     // e.g. 50 px
  maxWordsPerLine: number;
  glowEffect: boolean;
  popAnimation: boolean;
  animationDurationMs: number;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleConfig = {
  mode: 'kinetic-word',
  fontFamily: 'Montserrat, Arial, sans-serif',
  fontSize: 32,
  fontWeight: '800',
  textColor: '#FFFFFF',
  highlightColor: '#F59E0B', // Amber
  outlineColor: '#000000',
  outlineWidth: 3,
  shadowColor: '#000000',
  shadowDepth: 2,
  backgroundColor: '#000000',
  backgroundOpacity: 0.3,
  position: 'bottom',
  verticalMargin: 60,
  maxWordsPerLine: 5,
  glowEffect: true,
  popAnimation: true,
  animationDurationMs: 120,
};

/**
 * Formats seconds into SRT timestamp: HH:MM:SS,mmm
 */
export function formatSrtTime(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const totalMs = Math.round(safeSec * 1000);
  const ms = totalMs % 1000;
  const totalSecs = Math.floor(totalMs / 1000);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hrs = Math.floor(totalSecs / 3600);

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Formats seconds into ASS timestamp: H:MM:SS.cc (centiseconds)
 */
export function formatAssTime(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const totalCs = Math.round(safeSec * 100);
  const cs = totalCs % 100;
  const totalSecs = Math.floor(totalCs / 100);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hrs = Math.floor(totalSecs / 3600);

  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Converts CSS Hex (#RRGGBB) to ASS color format (&H00BBGGRR&)
 */
export function hexToAssColor(hex: string, alphaHex: string = '00'): string {
  const clean = hex.replace('#', '').trim();
  let r = 'FF', g = 'FF', b = 'FF';
  if (clean.length === 6) {
    r = clean.slice(0, 2);
    g = clean.slice(2, 4);
    b = clean.slice(4, 6);
  } else if (clean.length === 3) {
    r = clean[0] + clean[0];
    g = clean[1] + clean[1];
    b = clean[2] + clean[2];
  }
  return `&H${alphaHex}${b}${g}${r}&`.toUpperCase();
}

/**
 * Converts opacity (0..1) to ASS Alpha Hex (00 = opaque, FF = fully transparent)
 */
export function opacityToAssAlpha(opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  const transparency = Math.round((1 - clamped) * 255);
  return transparency.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Generates an SRT string from subtitle segments
 */
export function generateSrt(segments: SubtitleSegment[]): string {
  return segments
    .filter(seg => seg.text.trim().length > 0 && seg.end > seg.start)
    .map((seg, idx) => {
      const start = formatSrtTime(seg.start);
      const end = formatSrtTime(seg.end);
      return `${idx + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

/**
 * Generates a full ASS (Advanced SubStation Alpha) script with Kinetic Typography
 * Supports Mode A (Word-by-word with pop & karaoke timing tags) and Mode B (Cinematic phrase).
 */
export function generateAss(
  segments: SubtitleSegment[],
  style: SubtitleStyleConfig,
  videoWidth = 1920,
  videoHeight = 1080
): string {
  const primaryAssColor = hexToAssColor(style.textColor);
  const highlightAssColor = hexToAssColor(style.highlightColor);
  const outlineAssColor = hexToAssColor(style.outlineColor);
  const shadowAssColor = hexToAssColor(style.shadowColor);
  const bgAlpha = opacityToAssAlpha(style.backgroundOpacity);
  const backAssColor = hexToAssColor(style.backgroundColor, bgAlpha);

  const isBold = style.fontWeight === 'bold' || style.fontWeight === '800' || style.fontWeight === '900' ? 1 : 0;
  
  // Alignment: 2 = bottom-center, 5 = middle-center, 8 = top-center
  let alignment = 2;
  if (style.position === 'center') alignment = 5;
  if (style.position === 'top') alignment = 8;

  const header = `[Script Info]
Title: AI Video Studio Kinetic Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily.split(',')[0].trim()},${style.fontSize},${primaryAssColor},${highlightAssColor},${outlineAssColor},${backAssColor},${isBold},0,0,0,100,100,0,0,1,${style.outlineWidth},${style.shadowDepth},${alignment},40,40,${style.verticalMargin},1
Style: Highlight,${style.fontFamily.split(',')[0].trim()},${style.fontSize},${highlightAssColor},${primaryAssColor},${outlineAssColor},${backAssColor},${isBold},0,0,0,100,100,0,0,1,${style.outlineWidth},${style.shadowDepth},${alignment},40,40,${style.verticalMargin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogueLines: string[] = [];

  for (const seg of segments) {
    if (!seg.text.trim()) continue;

    if (style.mode === 'kinetic-word' && seg.words && seg.words.length > 0) {
      // MODE A: Frame-accurate word-by-word kinetic typography
      // For each word in the segment, render an active event with dynamic highlight & pop
      for (let i = 0; i < seg.words.length; i++) {
        const currWord = seg.words[i];
        const wordStart = formatAssTime(currWord.start);
        const wordEnd = formatAssTime(currWord.end);

        // Build line where the active word is highlighted with pop effect
        const formattedWords = seg.words.map((w, wIdx) => {
          if (wIdx === i) {
            // Active word: scale pop animation and highlight color
            const popTag = style.popAnimation 
              ? `{\\t(0,${style.animationDurationMs},\\fscx115\\fscy115)\\t(${style.animationDurationMs},${style.animationDurationMs * 2},\\fscx100\\fscy100)}` 
              : '';
            const glowTag = style.glowEffect ? `{\\blur3}` : '';
            return `{\\c${highlightAssColor}}${popTag}${glowTag}${w.word}{\\r}`;
          } else {
            return `{\\c${primaryAssColor}}${w.word}`;
          }
        });

        const lineText = formattedWords.join(' ');
        dialogueLines.push(
          `Dialogue: 0,${wordStart},${wordEnd},Default,,0,0,0,,${lineText}`
        );
      }
    } else {
      // MODE B: Phrase-by-phrase Cinematic Subtitles with smooth fade
      const start = formatAssTime(seg.start);
      const end = formatAssTime(seg.end);
      const fadeTag = `{\\fad(200,200)}`;
      const cleanText = seg.text.replace(/\r?\n/g, '\\N');
      dialogueLines.push(
        `Dialogue: 0,${start},${end},Default,,0,0,0,,${fadeTag}${cleanText}`
      );
    }
  }

  return header + dialogueLines.join('\n') + '\n';
}

/**
 * Splits raw transcribed words into natural subtitle segments respecting max words per line
 */
export function groupWordsIntoSegments(
  words: WordTimestamp[],
  maxWordsPerSegment = 6,
  maxSilenceGapSeconds = 0.8
): SubtitleSegment[] {
  if (!words || words.length === 0) return [];

  const segments: SubtitleSegment[] = [];
  let currentGroup: WordTimestamp[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = currentGroup[currentGroup.length - 1];

    const hasSilenceGap = prevWord && (word.start - prevWord.end) > maxSilenceGapSeconds;
    const endsWithPunctuation = prevWord && /[.!?]$/.test(prevWord.word);
    const reachesWordLimit = currentGroup.length >= maxWordsPerSegment;

    if (currentGroup.length > 0 && (hasSilenceGap || endsWithPunctuation || reachesWordLimit)) {
      segments.push({
        id: `seg-${segments.length + 1}`,
        start: currentGroup[0].start,
        end: currentGroup[currentGroup.length - 1].end,
        text: currentGroup.map(w => w.word).join(' '),
        words: [...currentGroup],
      });
      currentGroup = [];
    }

    currentGroup.push(word);
  }

  if (currentGroup.length > 0) {
    segments.push({
      id: `seg-${segments.length + 1}`,
      start: currentGroup[0].start,
      end: currentGroup[currentGroup.length - 1].end,
      text: currentGroup.map(w => w.word).join(' '),
      words: [...currentGroup],
    });
  }

  return segments;
}
