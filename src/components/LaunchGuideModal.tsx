import React from 'react';
import { X, Terminal, CheckCircle2, ShieldCheck, FolderCheck, Play } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LaunchGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Windows Local Setup & Launcher Guide</h3>
              <p className="text-xs text-zinc-400">Run natively on Windows with NVIDIA GPU acceleration & local folders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm text-zinc-300">
          <div className="space-y-3">
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" /> 1. Starting the Studio on Windows
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              AI Video Studio includes a zero-friction launcher. Open your project folder in Windows File Explorer and double-click:
            </p>
            <div className="p-3 rounded-lg bg-zinc-950 font-mono text-xs text-emerald-400 border border-zinc-800 flex items-center justify-between">
              <span>START_AI_VIDEO_STUDIO.bat</span>
              <span className="text-[10px] text-zinc-500">Double-click to run</span>
            </div>
            <p className="text-xs text-zinc-400">
              This launcher verifies Python, Node.js, and FFmpeg, checks your NVIDIA GPU/CUDA, starts the FastAPI engine on <code className="text-zinc-300">127.0.0.1:8000</code>, starts the React dashboard on <code className="text-zinc-300">localhost:3000</code>, and launches Chrome or Edge.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400" /> 2. One-Time Setup (INSTALL.bat)
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              If running for the first time, simply run:
            </p>
            <div className="p-3 rounded-lg bg-zinc-950 font-mono text-xs text-blue-400 border border-zinc-800">
              INSTALL.bat
            </div>
            <p className="text-xs text-zinc-400">
              It will create a virtual environment and install dependencies optimized for the <strong>NVIDIA GeForce RTX 5060 (Blackwell Architecture)</strong> with PyTorch 2.6+ (CUDA 12.8 wheel), Faster-Whisper, and Real-ESRGAN.
            </p>
          </div>

          <div className="space-y-2 p-3 rounded-lg bg-zinc-950/80 border border-purple-500/30">
            <h5 className="font-semibold text-purple-300 text-xs flex items-center gap-1.5">
              <span>NVIDIA RTX 5060 Blackwell Features Enabled:</span>
            </h5>
            <ul className="text-[11px] text-zinc-300 space-y-1 list-disc pl-4">
              <li><strong>Gen 9 NVENC AV1 Encoding:</strong> Crystal-clear 4K video exports at half the bitrate of H.264.</li>
              <li><strong>Dynamic VRAM Tiling:</strong> Zero-OOM protection adjusting tile inference based on your actual GDDR7 memory.</li>
              <li><strong>5th Gen Tensor Cores:</strong> Hardware-accelerated Faster-Whisper and neural resolution upscaling.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-purple-400" /> 3. Local Files & Output Folders
            </h4>
            <ul className="text-xs text-zinc-400 space-y-1.5 list-disc pl-5">
              <li>Use <strong className="text-zinc-200">Select Video</strong> to load any MP4, MOV, MKV, AVI, or WebM file from your computer.</li>
              <li>Click <strong className="text-zinc-200">SELECT OUTPUT FOLDER</strong> to pick any folder on your hard drive.</li>
              <li>Your browser will request permission via the standard <span className="text-zinc-200 font-mono">showDirectoryPicker</span> API, and finished MP4 renders write directly into that folder.</li>
              <li>Original source files are never altered or overwritten.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" /> 4. Privacy & Security
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              All video processing, speech recognition, and rendering happens locally on your computer. Videos are never uploaded to the cloud.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
