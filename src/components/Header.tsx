import React from 'react';
import { Film, Zap, Plus, Save, FolderOpen, Terminal, CheckCircle2, Shield, Info, Settings } from 'lucide-react';
import { HardwareTelemetry } from '../types';

interface Props {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onNewProject: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onOpenHardware: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  telemetry: HardwareTelemetry | null;
  isPythonEngine: boolean;
  isBackendConnected: boolean | null;
  isSaving: boolean;
}

export const Header: React.FC<Props> = ({
  projectName,
  onProjectNameChange,
  onNewProject,
  onSaveProject,
  onOpenProject,
  onOpenHardware,
  onOpenGuide,
  onOpenSettings,
  telemetry,
  isPythonEngine,
  isBackendConnected,
  isSaving,
}) => {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center justify-between select-none">
      {/* Brand & Project Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-zinc-100">AI VIDEO STUDIO</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                Local Engine
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-medium">Kinetic Subtitles • Whisper • Real-ESRGAN</p>
          </div>
        </div>

        <div className="h-5 w-px bg-zinc-800 mx-1 hidden sm:block" />

        {/* Project Input */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            className="bg-transparent hover:bg-zinc-900 focus:bg-zinc-900 border border-transparent hover:border-zinc-800 focus:border-zinc-700 text-xs font-medium text-zinc-200 rounded px-2 py-1 outline-none transition-all w-44"
            placeholder="Project Title..."
          />
          <button
            onClick={onNewProject}
            title="New Project"
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onSaveProject}
            title="Save Project"
            disabled={isSaving}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-pulse text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={onOpenProject}
            title="Open Project"
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Engine Status & Tools */}
      <div className="flex items-center gap-2.5">
        {/* Backend status indicator */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isBackendConnected ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isBackendConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
          </span>
          <span className={`font-mono text-[11px] ${isBackendConnected ? 'text-zinc-300' : 'text-red-400 font-semibold'}`}>
            {isBackendConnected
              ? (isPythonEngine ? 'Python Engine (8000)' : 'Backend Connected')
              : 'Backend Offline (503)'}
          </span>
        </div>

        {/* Hardware telemetry button */}
        <button
          onClick={onOpenHardware}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 transition-all cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Hardware:</span>
          <span className="font-mono text-[11px] text-zinc-200">
            {telemetry?.gpu.detected ? 'NVIDIA CUDA' : 'CPU / NVENC'}
          </span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Studio Settings & Diagnostics"
          className="p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
        </button>

        {/* Windows Setup Guide button */}
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs font-medium transition-all cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Windows Launcher</span>
        </button>
      </div>
    </header>
  );
};
