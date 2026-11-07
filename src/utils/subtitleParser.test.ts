import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSrtTime,
  formatAssTime,
  hexToAssColor,
  generateSrt,
  generateAss,
  groupWordsIntoSegments,
  DEFAULT_SUBTITLE_STYLE,
  SubtitleSegment,
  WordTimestamp,
} from './subtitleParser';

test('formatSrtTime formats seconds properly to HH:MM:SS,mmm', () => {
  assert.equal(formatSrtTime(0), '00:00:00,000');
  assert.equal(formatSrtTime(1.5), '00:00:01,500');
  assert.equal(formatSrtTime(65.123), '00:01:05,123');
  assert.equal(formatSrtTime(3661.045), '01:01:01,045');
});

test('formatAssTime formats seconds properly to H:MM:SS.cc', () => {
  assert.equal(formatAssTime(0), '0:00:00.00');
  assert.equal(formatAssTime(1.5), '0:00:01.50');
  assert.equal(formatAssTime(65.12), '0:01:05.12');
  assert.equal(formatAssTime(3661.04), '1:01:01.04');
});

test('hexToAssColor correctly converts CSS RGB hex to ASS BGR format', () => {
  // Red: #FF0000 -> BGR: 0000FF -> &H000000FF&
  assert.equal(hexToAssColor('#FF0000'), '&H000000FF&');
  // Blue: #0000FF -> BGR: FF0000 -> &H00FF0000&
  assert.equal(hexToAssColor('#0000FF'), '&H00FF0000&');
  // White: #FFFFFF -> BGR: FFFFFF -> &H00FFFFFF&
  assert.equal(hexToAssColor('#FFFFFF'), '&H00FFFFFF&');
});

test('groupWordsIntoSegments groups words based on sentence boundaries and count', () => {
  const words: WordTimestamp[] = [
    { id: '1', word: 'Welcome', start: 0.1, end: 0.5 },
    { id: '2', word: 'to', start: 0.6, end: 0.8 },
    { id: '3', word: 'AI', start: 0.9, end: 1.2 },
    { id: '4', word: 'Video', start: 1.3, end: 1.6 },
    { id: '5', word: 'Studio.', start: 1.7, end: 2.1 },
    { id: '6', word: 'Create', start: 2.5, end: 2.9 },
    { id: '7', word: 'kinetic', start: 3.0, end: 3.4 },
    { id: '8', word: 'subtitles.', start: 3.5, end: 4.0 },
  ];

  const segments = groupWordsIntoSegments(words, 5, 0.8);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].text, 'Welcome to AI Video Studio.');
  assert.equal(segments[1].text, 'Create kinetic subtitles.');
  assert.equal(segments[0].start, 0.1);
  assert.equal(segments[0].end, 2.1);
});

test('generateSrt outputs standard compliant SRT subtitles', () => {
  const segments: SubtitleSegment[] = [
    {
      id: 'seg-1',
      start: 1.0,
      end: 3.5,
      text: 'First line of dialogue',
      words: [],
    },
    {
      id: 'seg-2',
      start: 4.0,
      end: 6.25,
      text: 'Second line here',
      words: [],
    },
  ];

  const srt = generateSrt(segments);
  assert.ok(srt.includes('1\n00:00:01,000 --> 00:00:03,500\nFirst line of dialogue'));
  assert.ok(srt.includes('2\n00:00:04,000 --> 00:00:06,250\nSecond line here'));
});

test('generateAss outputs ASS format with kinetic typography tags in Mode A', () => {
  const segments: SubtitleSegment[] = [
    {
      id: 'seg-1',
      start: 0.5,
      end: 2.0,
      text: 'Ultra fast video',
      words: [
        { id: 'w1', word: 'Ultra', start: 0.5, end: 0.9 },
        { id: 'w2', word: 'fast', start: 1.0, end: 1.4 },
        { id: 'w3', word: 'video', start: 1.5, end: 2.0 },
      ],
    },
  ];

  const ass = generateAss(segments, { ...DEFAULT_SUBTITLE_STYLE, mode: 'kinetic-word' });
  assert.ok(ass.includes('[Script Info]'));
  assert.ok(ass.includes('[V4+ Styles]'));
  assert.ok(ass.includes('[Events]'));
  assert.ok(ass.includes('Dialogue: 0,0:00:00.50,0:00:00.90'));
  // Should have transform pop animation tag
  assert.ok(ass.includes('\\fscx115\\fscy115'));
});

test('generateAss outputs ASS format with cinematic fade in Mode B', () => {
  const segments: SubtitleSegment[] = [
    {
      id: 'seg-1',
      start: 0.5,
      end: 2.5,
      text: 'Cinematic phrase transition',
      words: [],
    },
  ];

  const ass = generateAss(segments, { ...DEFAULT_SUBTITLE_STYLE, mode: 'cinematic-phrase' });
  assert.ok(ass.includes('\\fad(200,200)'));
  assert.ok(ass.includes('Cinematic phrase transition'));
});
