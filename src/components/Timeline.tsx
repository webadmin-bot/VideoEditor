import React, { useRef } from 'react';
import { SubtitleSegment } from '../utils/subtitleParser';
import { Film, Type, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  duration: number;
  currentTime: number;
  segments: SubtitleSegment[];
  onSeek: (time: number) => void;
}

export const Timeline: React.FC<Props> = ({
  duration,
  currentTime,
  segments,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const totalDuration = Math.max(1, duration || 10);
  const playheadPercent = Math.min(100, (currentTime / totalDuration) * 100);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * totalDuration);
  };

  // Generate tick marks
  const numTicks = 10;
  const tickTimes = Array.from({ length: numTicks + 1 }, (_, i) => (totalDuration / numTicks) * i);

  return (
    <div className="h-28 bg-zinc-950 border-t border-zinc-800 flex flex-col select-none">
      {/* Time Ruler */}
      <div className="h-6 border-b border-zinc-850 px-4 flex items-center justify-between text-[10px] font-mono text-zinc-500 bg-zinc-900/40">
        <div className="flex items-center gap-1">
          <Film className="w-3 h-3 text-zinc-400" />
          <span className="font-semibold text-zinc-300">TIMELINE</span>
        </div>
        <div className="flex items-center gap-6">
          {tickTimes.map((t, idx) => (
            <span key={idx} className="hidden sm:inline">
              {t.toFixed(1)}s
            </span>
          ))}
          <span className="font-bold text-zinc-400">{totalDuration.toFixed(1)}s</span>
        </div>
      </div>

      {/* Tracks Container */}
      <div
        ref={containerRef}
        onClick={handleTimelineClick}
        className="relative flex-1 bg-zinc-900/60 p-2 cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        {/* Playhead Vertical Line */}
        <div
          className="absolute inset-y-0 z-30 pointer-events-none flex flex-col items-center"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="w-2.5 h-2.5 -top-1 bg-amber-400 rotate-45 shadow-md" />
          <div className="w-0.5 h-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
        </div>

        {/* Track 1: Video Frames Track */}
        <div className="h-7 w-full rounded bg-zinc-850 border border-zinc-750 flex items-center px-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/20 via-purple-900/20 to-indigo-900/20" />
          <span className="text-[10px] font-semibold text-indigo-300 flex items-center gap-1 z-10">
            <Film className="w-3 h-3" /> Video Stream (30 fps)
          </span>
        </div>

        {/* Track 2: Kinetic Subtitles Track */}
        <div className="h-8 w-full rounded bg-zinc-850/80 border border-zinc-750 relative overflow-hidden">
          <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none z-10">
            <span className="text-[10px] font-semibold text-amber-300/80 flex items-center gap-1">
              <Type className="w-3 h-3" /> Subtitle Track
            </span>
          </div>

          {/* Subtitle segments blocks */}
          {segments.map((seg) => {
            const leftPct = (seg.start / totalDuration) * 100;
            const widthPct = Math.max(1, ((seg.end - seg.start) / totalDuration) * 100);
            const isCurrent = currentTime >= seg.start && currentTime <= seg.end;

            return (
              <div
                key={seg.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(seg.start);
                }}
                className={`absolute inset-y-1 rounded border px-1.5 flex items-center text-[10px] font-medium truncate transition-all ${
                  isCurrent
                    ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20 z-20'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750'
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                }}
                title={`[${seg.start}s - ${seg.end}s] ${seg.text}`}
              >
                <span className="truncate">{seg.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
