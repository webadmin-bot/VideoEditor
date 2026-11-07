import React from 'react';
import { ProcessingJob } from '../types';
import {
  Activity, CheckCircle2, AlertOctagon, XCircle, Clock,
  Download, FileText, Film, ShieldCheck, RefreshCw, X
} from 'lucide-react';

interface Props {
  activeJob: ProcessingJob | null;
  onCancelJob: (jobId: string) => void;
  onDownloadArtifact: (filename: string, content: string | Blob) => void;
}

export const JobQueuePanel: React.FC<Props> = ({
  activeJob,
  onCancelJob,
  onDownloadArtifact,
}) => {
  if (!activeJob) {
    return (
      <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-zinc-900 mx-auto flex items-center justify-center text-zinc-500">
          <Activity className="w-5 h-5" />
        </div>
        <h4 className="text-xs font-semibold text-zinc-300">Engine Queue Idle</h4>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Ready for speech transcription, kinetic typography compilation, or video rendering.
        </p>
      </div>
    );
  }

  const isCompleted = activeJob.stage === 'COMPLETED';
  const isFailed = activeJob.stage === 'FAILED';
  const isCancelled = activeJob.stage === 'CANCELLED';
  const isRunning = !isCompleted && !isFailed && !isCancelled;

  return (
    <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3.5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${isRunning ? 'text-indigo-400 animate-spin' : 'text-zinc-400'}`} />
          <span className="text-xs font-semibold text-zinc-200">
            {activeJob.job_type === 'RENDER' ? 'Video Render Job' : 'Audio Transcription Job'}
          </span>
        </div>

        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
            isCompleted
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : isFailed || isCancelled
              ? 'bg-red-500/10 text-red-300 border-red-500/30'
              : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 animate-pulse'
          }`}
        >
          {activeJob.stage}
        </span>
      </div>

      {/* Progress Bar & Percent */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400 text-[11px] truncate max-w-[200px]">{activeJob.message}</span>
          <span className="font-mono text-zinc-200 font-semibold">
            {activeJob.progress_percent > 0
              ? `${activeJob.progress_percent}%`
              : isCompleted
              ? '100%'
              : isRunning
              ? 'Active Stage'
              : '0%'}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted
                ? 'bg-emerald-500'
                : isFailed
                ? 'bg-red-500'
                : activeJob.progress_percent <= 0
                ? 'bg-indigo-500 animate-pulse w-full'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500'
            }`}
            style={activeJob.progress_percent > 0 ? { width: `${activeJob.progress_percent}%` } : undefined}
          />
        </div>
      </div>

      {/* Timings */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span>Elapsed: {activeJob.elapsed_seconds}s</span>
        </div>
        <div>
          <span>
            {activeJob.estimated_remaining_seconds !== null && isRunning
              ? `ETA: ~${activeJob.estimated_remaining_seconds}s`
              : isCompleted
              ? 'Status: Finished'
              : 'Status: ' + activeJob.stage}
          </span>
        </div>
      </div>

      {/* Cancel button if running */}
      {isRunning && (
        <button
          onClick={() => onCancelJob(activeJob.id)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-medium transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel Active Job</span>
        </button>
      )}

      {/* Completed Artifacts Downloader */}
      {isCompleted && activeJob.artifacts && (
        <div className="pt-2 border-t border-zinc-850 space-y-2">
          <span className="text-[11px] font-semibold text-zinc-300 block">Export Artifacts Ready:</span>

          <div className="space-y-1.5">
            {activeJob.artifacts.video_filename && (
              <button
                onClick={() =>
                  onDownloadArtifact(
                    activeJob.artifacts?.video_filename || 'rendered_video.mp4',
                    activeJob.artifacts?.video_url || ''
                  )
                }
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  <span>{activeJob.artifacts.video_filename}</span>
                </div>
                <Download className="w-3.5 h-3.5" />
              </button>
            )}

            {activeJob.artifacts.srt_content && (
              <button
                onClick={() =>
                  onDownloadArtifact('subtitles.srt', activeJob.artifacts?.srt_content || '')
                }
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-medium transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Subtitles (SRT File)</span>
                </div>
                <Download className="w-3.5 h-3.5" />
              </button>
            )}

            {activeJob.artifacts.ass_content && (
              <button
                onClick={() =>
                  onDownloadArtifact('kinetic_subtitles.ass', activeJob.artifacts?.ass_content || '')
                }
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-amber-300 text-xs font-medium transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kinetic Subtitles (ASS Script)</span>
                </div>
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
