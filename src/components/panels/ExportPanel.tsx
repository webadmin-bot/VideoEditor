import React from 'react';
import { ExportSettings } from '../../types';
import { Download, FolderCheck, FolderPlus, Video, Settings2, ShieldCheck, Play } from 'lucide-react';
import { isDirectoryPickerSupported } from '../../utils/fileSystemAccess';

interface Props {
  settings: ExportSettings;
  onChange: (settings: ExportSettings) => void;
  outputDirectoryName: string | null;
  onSelectOutputDirectory: () => void;
  onStartRender: () => void;
  isRendering: boolean;
  canRender: boolean;
}

export const ExportPanel: React.FC<Props> = ({
  settings,
  onChange,
  outputDirectoryName,
  onSelectOutputDirectory,
  onStartRender,
  isRendering,
  canRender,
}) => {
  const update = (patch: Partial<ExportSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const hasFsa = isDirectoryPickerSupported();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Video className="w-4 h-4 text-emerald-400" /> Render Engine & Master Export
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Configure hardware encoding, burn kinetic subtitles, and write finished video to local disk.
        </p>
      </div>

      {/* Output Folder Selection Card (Section 4 Requirement) */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
          <div className="flex items-center gap-2">
            {outputDirectoryName ? (
              <FolderCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <FolderPlus className="w-4 h-4 text-zinc-400" />
            )}
            <span className="text-xs font-semibold text-zinc-200">Local Destination Folder</span>
          </div>

          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              outputDirectoryName
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-zinc-850 text-zinc-400 border-zinc-750'
            }`}
          >
            {outputDirectoryName ? 'Folder Connected' : 'Default Downloads'}
          </span>
        </div>

        <div className="text-xs">
          <span className="text-zinc-500 text-[11px] block mb-1">Target Directory:</span>
          <p className="font-mono text-zinc-200 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 truncate">
            {outputDirectoryName ? `📁 ${outputDirectoryName}` : 'Downloads / AI Video Studio'}
          </p>
        </div>

        <button
          onClick={onSelectOutputDirectory}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-750 transition-colors cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5 text-zinc-400" />
          <span>{outputDirectoryName ? 'Change Output Folder' : 'SELECT OUTPUT FOLDER'}</span>
        </button>

        {!hasFsa && (
          <p className="text-[10px] text-zinc-500 leading-tight">
            * Note: Your current browser will save finished videos via direct browser file stream download.
          </p>
        )}
      </div>

      {/* Video Encoder & Format Settings */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3 text-xs">
        <h4 className="font-semibold text-zinc-200 flex items-center gap-1.5 pb-2 border-b border-zinc-850">
          <Settings2 className="w-3.5 h-3.5 text-zinc-400" /> Export Configuration
        </h4>

        {/* Video Codec */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-zinc-400 text-[11px] block mb-1">Video Encoder</label>
            <select
              value={settings.videoCodec}
              onChange={(e) => update({ videoCodec: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 rounded px-2.5 py-1 text-xs outline-none"
            >
              <option value="auto">Auto (Prefer RTX 5060 NVENC)</option>
              <option value="av1_nvenc">av1_nvenc (NVIDIA RTX 5060 AV1 HW)</option>
              <option value="h264_nvenc">h264_nvenc (NVIDIA GPU H.264)</option>
              <option value="hevc_nvenc">hevc_nvenc (NVIDIA GPU H.265)</option>
              <option value="libx264">libx264 (Software CPU Fallback)</option>
              <option value="libx265">libx265 (CPU HEVC Fallback)</option>
            </select>
          </div>

          <div>
            <label className="text-zinc-400 text-[11px] block mb-1">Audio Track</label>
            <select
              value={settings.audioCodec}
              onChange={(e) => update({ audioCodec: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 rounded px-2.5 py-1 text-xs outline-none"
            >
              <option value="copy">Preserve Original (Direct Copy)</option>
              <option value="aac">Encode AAC (192kbps Stereo)</option>
            </select>
          </div>
        </div>

        {/* Quality / CRF */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-zinc-400 text-[11px]">
            <span>Quality (CRF):</span>
            <span className="font-mono text-zinc-200">
              {settings.qualityCrf} {settings.qualityCrf <= 18 ? '(Visually Lossless)' : '(High Quality)'}
            </span>
          </div>
          <input
            type="range"
            min={14}
            max={28}
            value={settings.qualityCrf}
            onChange={(e) => update({ qualityCrf: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Output Filename */}
        <div>
          <label className="text-zinc-400 text-[11px] block mb-1">Export Filename</label>
          <input
            type="text"
            value={settings.outputFilename}
            onChange={(e) => update({ outputFilename: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 rounded px-2.5 py-1.5 font-mono text-xs outline-none"
          />
        </div>
      </div>

      {/* Render Action Button */}
      <button
        onClick={onStartRender}
        disabled={!canRender || isRendering}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
      >
        <Play className={`w-4 h-4 ${isRendering ? 'animate-spin' : ''}`} />
        <span>{isRendering ? 'Rendering Video...' : 'START VIDEO RENDER'}</span>
      </button>
    </div>
  );
};
