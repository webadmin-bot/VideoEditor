import React, { useState, useRef } from 'react';
import { VideoMetadata } from '../../types';
import {
  Film, HardDrive, Clock, Maximize2, Activity, Volume2, Upload, AlertCircle, FileVideo, Check
} from 'lucide-react';

interface Props {
  metadata: VideoMetadata | null;
  onSelectVideo: () => void;
  onLoadDemo: () => void;
  onFileDrop?: (file: File) => void;
}

export const MediaPanel: React.FC<Props> = ({
  metadata,
  onSelectVideo,
  onLoadDemo,
  onFileDrop,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      if (onFileDrop) {
        onFileDrop(dropped);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (onFileDrop) {
        onFileDrop(file);
      }
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-400" /> Source Video & Media Stream
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Select input video via File System Access API or drag-and-drop. Processed entirely locally.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-950/30 ring-2 ring-indigo-500/20'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/60 hover:bg-zinc-900/40'
        }`}
      >
        <div className="w-10 h-10 rounded-full bg-indigo-600/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs font-semibold text-zinc-200 block">
            Drop video file here or click to browse
          </span>
          <span className="text-[11px] text-zinc-500">
            Supports MP4, MOV, MKV, AVI, WebM via local FFprobe
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/x-msvideo,video/webm,.mp4,.mov,.mkv,.avi,.webm"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Format Compatibility Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-zinc-500 font-medium mr-1">Supported:</span>
        {['MP4', 'MOV', 'MKV', 'AVI', 'WEBM'].map((fmt) => (
          <span
            key={fmt}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800"
          >
            {fmt}
          </span>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onSelectVideo}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>System File Picker</span>
        </button>

        <button
          onClick={onLoadDemo}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all cursor-pointer"
        >
          <FileVideo className="w-3.5 h-3.5 text-zinc-400" />
          <span>Sample Video</span>
        </button>
      </div>

      {/* Metadata Card */}
      {metadata ? (
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
            <span className="text-xs font-medium text-zinc-300 truncate max-w-[180px]" title={metadata.filename}>
              {metadata.filename}
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-indigo-300 border border-zinc-700">
              {metadata.format_name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Maximize2 className="w-3.5 h-3.5 text-zinc-500" />
              <div>
                <span className="text-zinc-500 text-[10px] block">Resolution</span>
                <span className="font-mono text-zinc-200">{metadata.width} x {metadata.height}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-zinc-500" />
              <div>
                <span className="text-zinc-500 text-[10px] block">Frame Rate</span>
                <span className="font-mono text-zinc-200">{metadata.fps} fps</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <div>
                <span className="text-zinc-500 text-[10px] block">Duration</span>
                <span className="font-mono text-zinc-200">{metadata.duration_seconds}s</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
              <div>
                <span className="text-zinc-500 text-[10px] block">File Size</span>
                <span className="font-mono text-zinc-200">{metadata.file_size_mb} MB</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Film className="w-3.5 h-3.5 text-zinc-500" />
              <div>
                <span className="text-zinc-500 text-[10px] block">Video Codec</span>
                <span className="font-mono text-zinc-200">{metadata.video_codec}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
              <div>
                <span className="text-zinc-500 text-[10px] block">Audio Codec</span>
                <span className="font-mono text-zinc-200">
                  {metadata.has_audio ? `${metadata.audio_codec} (${metadata.audio_channels}ch)` : 'None'}
                </span>
              </div>
            </div>
          </div>

          {metadata.warning && (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{metadata.warning}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
          No media stream loaded. Select or drag a local video above to inspect FFprobe properties.
        </div>
      )}
    </div>
  );
};

