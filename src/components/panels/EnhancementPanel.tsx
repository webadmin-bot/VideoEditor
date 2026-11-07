import React, { useState, useEffect } from 'react';
import { EnhancementConfig, PresetName, ENHANCEMENT_PRESETS, requiresAiModelRunner } from '../../utils/enhancementEngine';
import { Sliders, Sparkles, Cpu, ShieldAlert, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface Props {
  config: EnhancementConfig;
  onChange: (config: EnhancementConfig) => void;
  onPreviewRefresh: () => void;
  isGeneratingPreview: boolean;
}

export const EnhancementPanel: React.FC<Props> = ({
  config,
  onChange,
  onPreviewRefresh,
  isGeneratingPreview,
}) => {
  const [modelsStatus, setModelsStatus] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    apiClient.getModelsStatus()
      .then((status) => {
        if (mounted) setModelsStatus(status);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const update = (patch: Partial<EnhancementConfig>) => {
    onChange({ ...config, ...patch, preset: 'Custom' });
  };

  const applyPreset = (presetName: PresetName) => {
    if (presetName === 'Custom') return;
    const presetValues = ENHANCEMENT_PRESETS[presetName];
    onChange({
      ...config,
      ...presetValues,
      preset: presetName,
    });
  };

  const isAiActive = requiresAiModelRunner(config);
  const realEsrganAvailable = modelsStatus?.realesrgan?.available ?? false;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> AI Video Enhancement & Grading
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Local neural upscaling and color correction. Clearly distinguishes AI models from FFmpeg filters.
        </p>
      </div>

      {/* Preset Selector */}
      <div className="space-y-1.5">
        <label className="text-zinc-400 text-[11px] font-medium block">Production Presets</label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {(['Natural', 'Cinematic', 'Sharp and Detailed', 'Clean and Smooth'] as PresetName[]).map((p) => {
            const isSelected = config.preset === p;
            return (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3 py-2 rounded-lg border text-left font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500/40 text-purple-200 shadow-sm'
                    : 'bg-zinc-950 border-zinc-850 hover:border-zinc-750 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px]">{p}</span>
                  {isSelected && <Check className="w-3 h-3 text-purple-400" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Upscaling Section */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-zinc-200">Neural Resolution Upscaling</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
              isAiActive
                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            {isAiActive ? 'AI Model Running' : 'FFmpeg Filter Graph'}
          </span>
        </div>

        {/* Upscale Target */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-zinc-400 text-[11px] block mb-1">Target Resolution</label>
            <select
              value={config.upscaleTarget}
              onChange={(e) => update({ upscaleTarget: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 rounded px-2.5 py-1 text-xs outline-none"
            >
              <option value="None">Source Resolution (No Scale)</option>
              <option value="1080p">Full HD 1080p (1920x1080)</option>
              <option value="2K">2K Quad HD (2560x1440)</option>
              <option value="4K">4K Ultra HD (3840x2160)</option>
            </select>
          </div>

          <div>
            <label className="text-zinc-400 text-[11px] block mb-1">AI Engine Model</label>
            <select
              value={config.aiModel}
              onChange={(e) => update({ aiModel: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 rounded px-2.5 py-1 text-xs outline-none"
            >
              <option value="Real-ESRGAN-x2">Real-ESRGAN (x2 Upscale)</option>
              <option value="Real-ESRGAN-x4">Real-ESRGAN (x4 Ultra)</option>
              <option value="None">None (Conventional Lanczos)</option>
            </select>
          </div>
        </div>

        {/* Real-ESRGAN Availability / Transparency Banner */}
        {config.aiModel !== 'None' ? (
          modelsStatus && !realEsrganAvailable ? (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold block">Real-ESRGAN Model Unavailable</span>
                <span>
                  The Real-ESRGAN package is not installed in your Python backend environment.
                  Select <strong>None (Conventional Lanczos)</strong> for standard FFmpeg scaling, or install Real-ESRGAN.
                </span>
              </div>
            </div>
          ) : realEsrganAvailable ? (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
              <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>Real-ESRGAN ready on {modelsStatus?.realesrgan?.device || 'CUDA GPU'}.</span>
            </div>
          ) : null
        ) : (
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <span>Using conventional FFmpeg Lanczos scaler. Not labeled as AI.</span>
          </div>
        )}

        {/* Tiled Processing Toggle & VRAM Safeguard */}
        <div className="pt-2 border-t border-zinc-850/60 space-y-2">
          <label className="flex items-center justify-between text-zinc-300 cursor-pointer">
            <span className="flex items-center gap-1.5">
              <span>Tiled Processing (VRAM Protection)</span>
            </span>
            <input
              type="checkbox"
              checked={config.tiledProcessing}
              onChange={(e) => update({ tiledProcessing: e.target.checked })}
              className="rounded bg-zinc-900 border-zinc-700 text-purple-500 focus:ring-0 cursor-pointer"
            />
          </label>

          {config.tiledProcessing && (
            <div className="flex items-center justify-between text-zinc-300 pl-4 py-1 text-[11px]">
              <span className="text-zinc-400">Tile Size (VRAM allocation):</span>
              <select
                value={config.tileSize || 512}
                onChange={(e) => update({ tileSize: parseInt(e.target.value, 10) })}
                className="bg-zinc-900 border border-zinc-750 text-zinc-200 rounded px-2 py-0.5 text-xs outline-none"
              >
                <option value={256}>256x256 (Ultra-Safe / 4GB-6GB)</option>
                <option value={512}>512x512 (Recommended / RTX 5060 8GB)</option>
                <option value={1024}>1024x1024 (Fastest / 12GB+ VRAM)</option>
              </select>
            </div>
          )}

          {/* CodeFormer Face Restoration - Disabled since not installed */}
          <div className="flex items-center justify-between text-zinc-400 opacity-60">
            <span className="flex items-center gap-1.5">
              <span>CodeFormer Face Restoration</span>
              <span className="text-[10px] text-zinc-500 font-mono">(Unavailable — Not Installed)</span>
            </span>
            <input
              type="checkbox"
              disabled
              checked={false}
              className="rounded bg-zinc-900 border-zinc-750 text-zinc-600 cursor-not-allowed"
            />
          </div>

          {/* Stabilization Toggle */}
          <label className="flex items-center justify-between text-zinc-300 cursor-pointer pt-1">
            <span className="flex items-center gap-1.5">
              <span>Video Stabilization (FFmpeg vidstab)</span>
            </span>
            <input
              type="checkbox"
              checked={config.stabilization}
              onChange={(e) => update({ stabilization: e.target.checked })}
              className="rounded bg-zinc-900 border-zinc-700 text-purple-500 focus:ring-0 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Conventional Video Filters (Denoise, Sharpen, Color EQ) */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3 text-xs">
        <h4 className="font-semibold text-zinc-200 flex items-center gap-1.5 pb-2 border-b border-zinc-850">
          <Sliders className="w-3.5 h-3.5 text-zinc-400" /> Color Correction & Filters
        </h4>

        {/* Contrast Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400 text-[11px]">
            <span>Contrast:</span>
            <span className="font-mono text-zinc-200">{config.contrast.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.7}
            max={1.5}
            step={0.02}
            value={config.contrast}
            onChange={(e) => update({ contrast: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Brightness Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400 text-[11px]">
            <span>Brightness:</span>
            <span className="font-mono text-zinc-200">
              {config.brightness > 0 ? `+${config.brightness.toFixed(2)}` : config.brightness.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={-0.3}
            max={0.3}
            step={0.01}
            value={config.brightness}
            onChange={(e) => update({ brightness: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Saturation Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400 text-[11px]">
            <span>Saturation:</span>
            <span className="font-mono text-zinc-200">{config.saturation.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.8}
            step={0.02}
            value={config.saturation}
            onChange={(e) => update({ saturation: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Denoise Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400 text-[11px]">
            <span>Denoising Strength (hqdn3d):</span>
            <span className="font-mono text-zinc-200">{config.denoiseStrength}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            value={config.denoiseStrength}
            onChange={(e) => update({ denoiseStrength: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Sharpen Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400 text-[11px]">
            <span>Sharpening Strength (unsharp):</span>
            <span className="font-mono text-zinc-200">{config.sharpenStrength}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            value={config.sharpenStrength}
            onChange={(e) => update({ sharpenStrength: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-purple-500"
          />
        </div>
      </div>
    </div>
  );
};
