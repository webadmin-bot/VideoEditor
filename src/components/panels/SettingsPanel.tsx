import React, { useState } from 'react';
import {
  Settings, Server, HardDrive, Cpu, RefreshCw, CheckCircle2, AlertCircle, Trash2, ShieldCheck, Zap
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { HardwareTelemetry } from '../../types';

interface Props {
  telemetry: HardwareTelemetry | null;
  onRefreshTelemetry: () => void;
  preferredEncoder: string;
  onEncoderChange: (encoder: string) => void;
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const SettingsPanel: React.FC<Props> = ({
  telemetry,
  onRefreshTelemetry,
  preferredEncoder,
  onEncoderChange,
  onShowToast,
}) => {
  const [backendUrl, setBackendUrl] = useState('http://127.0.0.1:8000');
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{ success: boolean; latency_ms: number; service?: string } | null>(null);

  const [isTestingDisk, setIsTestingDisk] = useState(false);
  const [diskResult, setDiskResult] = useState<{ writable: boolean; latency_ms: number; target_path: string } | null>(null);

  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ count: number; freed_mb: number } | null>(null);

  const [autoPreview, setAutoPreview] = useState(true);
  const [telemetryInterval, setTelemetryInterval] = useState('3000');

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setConnResult(null);
    try {
      const res = await apiClient.testConnection(backendUrl);
      setConnResult(res);
      if (res.success) {
        onShowToast(`Connected to backend (${res.latency_ms}ms)`, 'success');
      } else {
        onShowToast('Backend connection test failed. Verify local engine is running.', 'error');
      }
    } catch (err: any) {
      setConnResult({ success: false, latency_ms: 0 });
      onShowToast(err.message || 'Connection test error', 'error');
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleTestDiskWrite = async () => {
    setIsTestingDisk(true);
    setDiskResult(null);
    try {
      const res = await apiClient.testDiskWrite();
      setDiskResult(res);
      if (res.writable) {
        onShowToast(`Disk write check passed (${res.latency_ms}ms) at ${res.target_path}`, 'success');
      } else {
        onShowToast('Disk write check failed: Write permission denied.', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Disk write check failed', 'error');
    } finally {
      setIsTestingDisk(false);
    }
  };

  const handleCleanStorage = async () => {
    setIsCleaning(true);
    try {
      const res = await apiClient.cleanStorage();
      if (res.success) {
        setCleanResult({ count: res.deleted_count, freed_mb: res.freed_mb });
        onShowToast(`Purged ${res.deleted_count} temporary files (${res.freed_mb} MB freed)`, 'success');
      } else {
        onShowToast('Storage cleanup failed', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Storage cleanup failed', 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" /> Studio & Engine Settings
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Configure local backend connection, hardware encoding parameters, and local storage.
        </p>
      </div>

      {/* Backend Engine Connection */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-indigo-400" /> Python Backend Connection
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-300">
            Localhost Only
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-zinc-400">FastAPI Server URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 outline-none"
              placeholder="http://127.0.0.1:8000"
            />
            <button
              onClick={handleTestConnection}
              disabled={isTestingConn}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isTestingConn ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Test Ping</span>
            </button>
          </div>
        </div>

        {connResult && (
          <div
            className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${
              connResult.success
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/40 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {connResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span>{connResult.success ? 'Engine online & responsive' : 'Connection failed (offline)'}</span>
            </div>
            <span className="font-mono text-[11px]">{connResult.latency_ms} ms</span>
          </div>
        )}
      </div>

      {/* Hardware Encoding Configuration */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-400" /> Hardware Video Acceleration
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-850 text-purple-300">
            Blackwell Gen 9 NVENC
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-zinc-400">Default Video Hardware Encoder</label>
          <select
            value={preferredEncoder}
            onChange={(e) => onEncoderChange(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-lg px-2.5 py-2 text-xs font-mono text-zinc-200 outline-none"
          >
            <option value="auto">auto — Detect optimal GPU encoder (av1_nvenc / hevc_nvenc)</option>
            <option value="av1_nvenc">av1_nvenc — RTX 5060 Gen 9 Dual NVENC AV1 (Best Compression & Quality)</option>
            <option value="hevc_nvenc">hevc_nvenc — NVIDIA NVENC H.265 / HEVC 4K HDR</option>
            <option value="h264_nvenc">h264_nvenc — NVIDIA NVENC H.264 High Performance</option>
            <option value="libx264">libx264 — CPU Software Fallback (High CPU utilization)</option>
          </select>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            NVIDIA GeForce RTX 5060 Blackwell GPU includes Gen 9 NVENC with native dual-stream AV1 encoding for ultra-fast render exports without dropped frames.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-zinc-300">Current GPU Detected</span>
          <span className="text-xs font-mono text-zinc-200">{telemetry?.gpu.model || 'RTX 5060 (Dynamic)'}</span>
        </div>
      </div>

      {/* Local Disk & Permissions Diagnostics */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Filesystem & Storage Diagnostics
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-850 text-emerald-300">
            Local Disk
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-200">Disk Write Permissions</p>
              <p className="text-[10px] text-zinc-400">Verifies local read/write/delete rights in storage folder.</p>
            </div>
            <button
              onClick={handleTestDiskWrite}
              disabled={isTestingDisk}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isTestingDisk ? 'animate-pulse text-emerald-400' : 'text-emerald-400'}`} />
              <span>Verify Write</span>
            </button>
          </div>

          {diskResult && (
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Write Status:</span>
                <span className={`font-semibold ${diskResult.writable ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diskResult.writable ? 'Passed (Writable)' : 'Permission Denied'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Latency:</span>
                <span className="font-mono text-zinc-300">{diskResult.latency_ms} ms</span>
              </div>
              <div className="text-[10px] text-zinc-500 truncate" title={diskResult.target_path}>
                Path: {diskResult.target_path}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-850 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-200">Purge Temp Cache</p>
              <p className="text-[10px] text-zinc-400">Clean temporary .ass, .srt and frame caches.</p>
            </div>
            <button
              onClick={handleCleanStorage}
              disabled={isCleaning}
              className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-300 text-xs font-medium border border-red-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Clean Cache</span>
            </button>
          </div>

          {cleanResult && (
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
              Freed {cleanResult.freed_mb} MB across {cleanResult.count} temporary files.
            </div>
          )}
        </div>
      </div>

      {/* Preferences */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3">
        <span className="text-xs font-semibold text-zinc-200">Editor & Telemetry Preferences</span>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-300 block">Live Enhancement Filter Preview</span>
            <span className="text-[10px] text-zinc-500">Render real-time color correction & canvas overlay</span>
          </div>
          <input
            type="checkbox"
            checked={autoPreview}
            onChange={(e) => setAutoPreview(e.target.checked)}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-xs text-zinc-300 block">Hardware Telemetry Polling Rate</span>
            <span className="text-[10px] text-zinc-500">Query interval for GPU VRAM and CPU clock</span>
          </div>
          <select
            value={telemetryInterval}
            onChange={(e) => setTelemetryInterval(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 outline-none"
          >
            <option value="1000">1.0 second</option>
            <option value="3000">3.0 seconds (Default)</option>
            <option value="5000">5.0 seconds</option>
          </select>
        </div>
      </div>
    </div>
  );
};
