import React from 'react';
import { X, Cpu, HardDrive, Zap, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { HardwareTelemetry } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  telemetry: HardwareTelemetry | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export const HardwareModal: React.FC<Props> = ({ isOpen, onClose, telemetry, onRefresh, isLoading }) => {
  if (!isOpen) return null;

  const vramUsedMb = telemetry?.gpu.vram_total_mb && telemetry?.gpu.vram_free_mb
    ? telemetry.gpu.vram_total_mb - telemetry.gpu.vram_free_mb
    : 0;
  const vramPercent = telemetry?.gpu.vram_total_mb
    ? Math.round((vramUsedMb / telemetry.gpu.vram_total_mb) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Workstation Hardware & Engine Status</h3>
              <p className="text-xs text-zinc-400">Detected local GPU, CPU, CUDA, and FFmpeg acceleration</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh telemetry"
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-sm">
          {/* GPU Section */}
          <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-850 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-zinc-200">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>NVIDIA GPU & CUDA Acceleration</span>
              </div>
              {telemetry?.gpu.detected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Hardware CUDA Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5" /> CPU Mode (GPU Standby)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 block">GPU Model:</span>
                <p className="font-mono text-zinc-100 font-semibold mt-0.5">
                  {telemetry?.gpu.model || 'NVIDIA GeForce RTX 5060'}
                </p>
                {telemetry?.gpu.architecture && (
                  <span className="inline-block mt-1 text-[10px] font-semibold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded">
                    {telemetry.gpu.architecture}
                  </span>
                )}
              </div>
              <div>
                <span className="text-zinc-500 block">Driver & CUDA Runtime:</span>
                <p className="font-mono text-zinc-200 mt-0.5">
                  Driver {telemetry?.gpu.driver_version || '572.xx+'} | CUDA {telemetry?.cuda.cuda_version || '12.8'}
                </p>
                {telemetry?.cuda.compute_capability && (
                  <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                    Compute: {telemetry.cuda.compute_capability}
                  </span>
                )}
              </div>
            </div>

            {/* VRAM Bar */}
            {telemetry?.gpu.vram_total_mb ? (
              <div className="space-y-1.5 pt-1 border-t border-zinc-850/60">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Dedicated GDDR7 VRAM Allocation (Dynamic)</span>
                  <span className="font-mono text-zinc-200 font-medium">
                    {Math.round(vramUsedMb / 1024 * 10) / 10} GB / {Math.round(telemetry.gpu.vram_total_mb / 1024 * 10) / 10} GB ({vramPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${Math.max(5, Math.min(100, vramPercent))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Available for Tiled Inference: {Math.round(telemetry.gpu.vram_free_mb / 1024 * 10) / 10} GB</span>
                  <span>Tile Size: {telemetry.recommended_upscale_tile}px (Zero OOM)</span>
                </div>
              </div>
            ) : null}

            {/* Compatibility Warnings if any */}
            {telemetry?.gpu.compatibility_warning && (
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{telemetry.gpu.compatibility_warning}</span>
              </div>
            )}
          </div>

          {/* CPU & Memory Section */}
          <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 font-medium text-zinc-200">
              <Cpu className="w-4 h-4 text-blue-400" />
              <span>Processor & System Memory</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-400">CPU Architecture:</span>
                <p className="font-mono text-zinc-200 mt-0.5">{telemetry?.cpu_model || 'Multi-core x86_64'}</p>
              </div>
              <div>
                <span className="text-zinc-400">Cores / Threads:</span>
                <p className="font-mono text-zinc-200 mt-0.5">
                  {telemetry?.cpu_cores_physical || 4} Physical / {telemetry?.cpu_cores_logical || 8} Logical Threads
                </p>
              </div>
            </div>

            {/* RAM Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">System RAM Usage</span>
                <span className="font-mono text-zinc-300">
                  {telemetry ? Math.round((telemetry.ram_total_gb - telemetry.ram_available_gb) * 10) / 10 : 0} GB / {telemetry?.ram_total_gb || 16} GB ({telemetry?.ram_percent_used || 0}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.max(5, Math.min(100, telemetry?.ram_percent_used || 40))}%` }}
                />
              </div>
            </div>
          </div>

          {/* FFmpeg Encoders */}
          <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 font-medium text-zinc-200">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span>FFmpeg Video Engine & Encoders</span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {telemetry?.ffmpeg.encoders && telemetry.ffmpeg.encoders.length > 0 ? (
                telemetry.ffmpeg.encoders.map((enc) => (
                  <span
                    key={enc}
                    className={`px-2.5 py-1 rounded-md border font-mono ${
                      enc.includes('nvenc')
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {enc} {enc.includes('nvenc') ? '(GPU HW Accelerated)' : '(Software CPU)'}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500">Scanning installed video codecs...</span>
              )}
            </div>

            <div className="text-xs text-zinc-400">
              Optimal Render Target: <span className="text-zinc-200 font-mono">{telemetry?.recommended_encoder || 'h264_nvenc'}</span> (Tiled upscale size: <span className="text-zinc-200 font-mono">{telemetry?.recommended_upscale_tile || 512}px</span>)
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
