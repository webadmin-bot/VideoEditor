import React, { useRef, useState, useEffect } from 'react';
import {
  Play, Pause, RotateCcw, Volume2, VolumeX, Maximize,
  SkipBack, SkipForward, Sliders, Sparkles, Layers
} from 'lucide-react';
import { SubtitleSegment, SubtitleStyleConfig } from '../utils/subtitleParser';
import { EnhancementConfig } from '../utils/enhancementEngine';

interface Props {
  videoSrc: string | null;
  segments: SubtitleSegment[];
  subtitleStyle: SubtitleStyleConfig;
  enhancement: EnhancementConfig;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onSelectVideo: () => void;
  onLoadDemoVideo: () => void;
}

export const VideoPlayer: React.FC<Props> = ({
  videoSrc,
  segments,
  subtitleStyle,
  enhancement,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  onSelectVideo,
  onLoadDemoVideo,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSplitView, setShowSplitView] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50); // percentage

  // Sync internal video state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      onDurationChange(video.duration || 0);
    };

    const handleTime = () => {
      onTimeUpdate(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTime);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTime);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoSrc]);

  // Handle external seek requests
  useEffect(() => {
    const video = videoRef.current;
    if (video && Math.abs(video.currentTime - currentTime) > 0.3) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.currentTime = target;
      onTimeUpdate(target);
    }
  };

  const handleStepFrame = (deltaFrames: number) => {
    const video = videoRef.current;
    if (!video) return;
    const frameDuration = 1 / 30; // 30 fps
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + deltaFrames * frameDuration));
    onTimeUpdate(video.currentTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 1.0, 1.25, 1.5, 2.0];
    const currIdx = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currIdx + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Format timecode: HH:MM:SS:FF (30 fps)
  const formatTimecode = (sec: number) => {
    const safe = Math.max(0, sec);
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = Math.floor(safe % 60);
    const frames = Math.floor((safe % 1) * 30);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  // Find active subtitle segment
  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  );

  // Determine active word in segment for kinetic Mode A
  const activeWordIndex = activeSegment?.words?.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  ) ?? -1;

  // Compute CSS filter string for real-time enhancement preview
  const cssFilter = `
    contrast(${enhancement.contrast * 100}%)
    saturate(${enhancement.saturation * 100}%)
    brightness(${100 + enhancement.brightness * 100}%)
  `;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl select-none"
    >
      {/* Top Toolbar overlay */}
      <div className="absolute top-0 inset-x-0 z-20 h-10 px-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-zinc-200 bg-black/60 px-2 py-0.5 rounded border border-zinc-700/50">
            {formatTimecode(currentTime)}
          </span>
          <span className="text-[11px] text-zinc-400">/ {formatTimecode(duration)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Split Screen Enhancement Preview Toggle */}
          <button
            onClick={() => setShowSplitView(!showSplitView)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              showSplitView
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-black/60 hover:bg-black/80 text-zinc-300 border-zinc-700/60'
            }`}
            title="Toggle Original vs Enhanced View"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split View</span>
          </button>
        </div>
      </div>

      {/* Main Video Stage */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {videoSrc ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Base Video Element */}
            <video
              ref={videoRef}
              src={videoSrc}
              playsInline
              onClick={togglePlay}
              className="max-w-full max-h-full object-contain cursor-pointer"
              style={{
                filter: showSplitView ? 'none' : cssFilter,
              }}
            />

            {/* Split Screen Overlay if enabled */}
            {showSplitView && (
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{
                  clipPath: `polygon(${splitPosition}% 0, 100% 0, 100% 100%, ${splitPosition}% 100%)`,
                }}
              >
                <video
                  src={videoSrc}
                  playsInline
                  className="w-full h-full object-contain"
                  style={{ filter: cssFilter }}
                />
                <span className="absolute top-12 right-4 px-2 py-1 rounded bg-indigo-600/80 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                  Enhanced Preview ({enhancement.preset})
                </span>
              </div>
            )}

            {showSplitView && (
              <span className="absolute top-12 left-4 px-2 py-1 rounded bg-black/70 text-[10px] font-bold text-zinc-300 uppercase tracking-wider backdrop-blur-sm">
                Original Raw
              </span>
            )}

            {/* Split slider draggable handle */}
            {showSplitView && (
              <div
                className="absolute inset-y-0 z-30 w-1 bg-indigo-500 cursor-ew-resize flex items-center justify-center"
                style={{ left: `${splitPosition}%` }}
              >
                <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg text-[9px] font-bold">
                  ⇄
                </div>
              </div>
            )}

            {/* KINETIC SUBTITLE OVERLAY */}
            {activeSegment && (
              <div
                className={`absolute inset-x-0 z-20 pointer-events-none flex justify-center px-8 transition-all ${
                  subtitleStyle.position === 'top'
                    ? 'top-12'
                    : subtitleStyle.position === 'center'
                    ? 'top-1/2 -translate-y-1/2'
                    : 'bottom-12'
                }`}
                style={{
                  marginBottom: subtitleStyle.position === 'bottom' ? `${subtitleStyle.verticalMargin}px` : undefined,
                  marginTop: subtitleStyle.position === 'top' ? `${subtitleStyle.verticalMargin}px` : undefined,
                }}
              >
                <div
                  className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 rounded-lg text-center"
                  style={{
                    backgroundColor: subtitleStyle.backgroundColor
                      ? `rgba(0,0,0,${subtitleStyle.backgroundOpacity})`
                      : 'transparent',
                    fontFamily: subtitleStyle.fontFamily,
                    fontSize: `${subtitleStyle.fontSize}px`,
                    fontWeight: subtitleStyle.fontWeight,
                  }}
                >
                  {subtitleStyle.mode === 'kinetic-word' && activeSegment.words && activeSegment.words.length > 0 ? (
                    // MODE A: Kinetic Word-by-Word
                    activeSegment.words.map((w, idx) => {
                      const isActive = idx === activeWordIndex;
                      return (
                        <span
                          key={w.id || idx}
                          className="inline-block transition-transform transform duration-100"
                          style={{
                            color: isActive ? subtitleStyle.highlightColor : subtitleStyle.textColor,
                            transform: isActive && subtitleStyle.popAnimation ? 'scale(1.18)' : 'scale(1)',
                            textShadow: isActive && subtitleStyle.glowEffect
                              ? `0 0 12px ${subtitleStyle.highlightColor}, 0 2px 4px ${subtitleStyle.shadowColor}`
                              : `0 2px 4px ${subtitleStyle.shadowColor}`,
                            WebkitTextStroke: `${subtitleStyle.outlineWidth}px ${subtitleStyle.outlineColor}`,
                          }}
                        >
                          {w.word}
                        </span>
                      );
                    })
                  ) : (
                    // MODE B: Phrase-by-Phrase Cinematic
                    <span
                      className="inline-block animate-fade-in tracking-wide"
                      style={{
                        color: subtitleStyle.textColor,
                        textShadow: `0 2px 6px ${subtitleStyle.shadowColor}`,
                        WebkitTextStroke: `${subtitleStyle.outlineWidth}px ${subtitleStyle.outlineColor}`,
                      }}
                    >
                      {activeSegment.text}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty State: Prompt to select video or load demo */
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-xl">
              <Layers className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-200 mb-1">No Video Loaded</h3>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
              Select an MP4, MOV, MKV, AVI, or WebM file from your computer using the File System Access API, or load a sample video to test kinetic typography immediately.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={onSelectVideo}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
              >
                Select Local Video
              </button>
              <button
                onClick={onLoadDemoVideo}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Load Sample Video
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Playback Controls Bar */}
      <div className="h-14 px-4 bg-zinc-900/90 border-t border-zinc-800 flex flex-col justify-center gap-1.5 z-20">
        {/* Scrub Bar */}
        <div className="relative flex items-center w-full group">
          <input
            type="range"
            min={0}
            max={duration || 10}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            disabled={!videoSrc}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none transition-all disabled:opacity-40"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleStepFrame(-1)}
              disabled={!videoSrc}
              title="Previous Frame"
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={togglePlay}
              disabled={!videoSrc}
              className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 disabled:opacity-40"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              onClick={() => handleStepFrame(1)}
              disabled={!videoSrc}
              title="Next Frame"
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  onTimeUpdate(0);
                }
              }}
              disabled={!videoSrc}
              title="Replay from start"
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={toggleMute}
                disabled={!videoSrc}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                disabled={!videoSrc}
                className="w-16 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSpeedChange}
              disabled={!videoSrc}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[11px] border border-zinc-700"
            >
              {playbackRate}x
            </button>
            <button
              onClick={toggleFullscreen}
              disabled={!videoSrc}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
