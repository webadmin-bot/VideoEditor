import React, { useState } from 'react';
import { SubtitleSegment, WordTimestamp } from '../../utils/subtitleParser';
import { Mic, Sparkles, Plus, Trash2, Edit2, Check, Clock, Brain } from 'lucide-react';

interface Props {
  segments: SubtitleSegment[];
  onSegmentsChange: (segments: SubtitleSegment[]) => void;
  onStartTranscription: (modelSize: string) => void;
  isTranscribing: boolean;
  onSeek: (time: number) => void;
  currentTime: number;
}

export const SpeechPanel: React.FC<Props> = ({
  segments,
  onSegmentsChange,
  onStartTranscription,
  isTranscribing,
  onSeek,
  currentTime,
}) => {
  const [modelSize, setModelSize] = useState('base');
  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editStart, setEditStart] = useState(0);
  const [editEnd, setEditEnd] = useState(0);

  const startEdit = (seg: SubtitleSegment) => {
    setEditingSegId(seg.id);
    setEditText(seg.text);
    setEditStart(seg.start);
    setEditEnd(seg.end);
  };

  const saveEdit = (segId: string) => {
    const updated = segments.map((s) => {
      if (s.id === segId) {
        // Re-generate word timestamps if text changed
        const wordsList = editText.split(/\s+/).filter(Boolean);
        const duration = Math.max(0.2, editEnd - editStart);
        const wordDuration = duration / Math.max(1, wordsList.length);

        const newWords: WordTimestamp[] = wordsList.map((w, idx) => ({
          id: `w-${Date.now()}-${idx}`,
          word: w,
          start: Math.round((editStart + idx * wordDuration) * 100) / 100,
          end: Math.round((editStart + (idx + 1) * wordDuration) * 100) / 100,
          confidence: 0.98,
        }));

        return {
          ...s,
          text: editText,
          start: editStart,
          end: editEnd,
          words: newWords,
        };
      }
      return s;
    });

    onSegmentsChange(updated);
    setEditingSegId(null);
  };

  const deleteSegment = (segId: string) => {
    onSegmentsChange(segments.filter((s) => s.id !== segId));
  };

  const addSegment = () => {
    const lastSeg = segments[segments.length - 1];
    const newStart = lastSeg ? lastSeg.end + 0.2 : currentTime;
    const newEnd = newStart + 2.0;

    const newSeg: SubtitleSegment = {
      id: `seg-${Date.now()}`,
      start: Math.round(newStart * 100) / 100,
      end: Math.round(newEnd * 100) / 100,
      text: 'New subtitle text here',
      words: [
        { id: `w-${Date.now()}-1`, word: 'New', start: newStart, end: newStart + 0.6 },
        { id: `w-${Date.now()}-2`, word: 'subtitle', start: newStart + 0.65, end: newStart + 1.3 },
        { id: `w-${Date.now()}-3`, word: 'text', start: newStart + 1.35, end: newStart + 2.0 },
      ],
    };

    onSegmentsChange([...segments, newSeg]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Mic className="w-4 h-4 text-emerald-400" /> Speech Recognition & Transcripts
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Faster-Whisper extracts phonetic word timestamps for kinetic typography.
        </p>
      </div>

      {/* Transcription Trigger Card */}
      <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <label className="text-zinc-300 font-medium">Whisper Model:</label>
          <select
            value={modelSize}
            onChange={(e) => setModelSize(e.target.value)}
            disabled={isTranscribing}
            className="bg-zinc-900 border border-zinc-750 text-zinc-200 rounded px-2.5 py-1 text-xs outline-none"
          >
            <option value="base">base (Fastest, ~140MB)</option>
            <option value="small">small (Balanced, ~460MB)</option>
            <option value="medium">medium (High Accuracy, ~1.5GB)</option>
          </select>
        </div>

        <button
          onClick={() => onStartTranscription(modelSize)}
          disabled={isTranscribing}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isTranscribing ? 'animate-spin' : ''}`} />
          <span>{isTranscribing ? 'Transcribing Audio...' : 'Transcribe Video Speech'}</span>
        </button>
      </div>

      {/* Segment Editor Header */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-semibold text-zinc-300">
          Transcript Segments ({segments.length})
        </span>
        <button
          onClick={addSegment}
          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[11px] font-medium border border-zinc-700 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Segment
        </button>
      </div>

      {/* Segments List */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {segments.map((seg) => {
          const isCurrent = currentTime >= seg.start && currentTime <= seg.end;
          const isEditing = editingSegId === seg.id;

          return (
            <div
              key={seg.id}
              className={`p-3 rounded-lg border text-xs transition-all ${
                isCurrent
                  ? 'bg-amber-500/10 border-amber-500/40 text-zinc-100 shadow-sm'
                  : 'bg-zinc-950 border-zinc-850 hover:border-zinc-750 text-zinc-300'
              }`}
            >
              {isEditing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 text-[10px]">Start:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={editStart}
                        onChange={(e) => setEditStart(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 font-mono text-[11px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 text-[10px]">End:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={editEnd}
                        onChange={(e) => setEditEnd(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500 resize-none"
                  />

                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setEditingSegId(null)}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[10px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(seg.id)}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold"
                    >
                      <Check className="w-3 h-3" /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-850/60">
                    <button
                      onClick={() => onSeek(seg.start)}
                      className="font-mono text-[10px] text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3" />
                      {seg.start.toFixed(1)}s → {seg.end.toFixed(1)}s
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(seg)}
                        title="Edit Text and Timestamps"
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteSegment(seg.id)}
                        title="Delete Segment"
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <p
                    onClick={() => onSeek(seg.start)}
                    className="cursor-pointer leading-relaxed text-zinc-200 hover:text-amber-300 transition-colors"
                  >
                    {seg.text}
                  </p>

                  {/* Word-level tokens display */}
                  {seg.words && seg.words.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-zinc-850/40">
                      {seg.words.map((w, wIdx) => {
                        const isWordActive = currentTime >= w.start && currentTime <= w.end;
                        return (
                          <span
                            key={w.id || wIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSeek(w.start);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-all ${
                              isWordActive
                                ? 'bg-amber-400 text-black font-bold scale-105 shadow-sm'
                                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                            }`}
                          >
                            {w.word}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
