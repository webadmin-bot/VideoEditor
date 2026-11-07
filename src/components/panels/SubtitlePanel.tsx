import React, { useState } from 'react';
import { SubtitleStyleConfig, SubtitleMode } from '../../utils/subtitleParser';
import { Type, Sparkles, Sliders, Palette, Eye, Code, Check } from 'lucide-react';

interface Props {
  styleConfig: SubtitleStyleConfig;
  onStyleConfigChange: (config: SubtitleStyleConfig) => void;
  onViewAssCode: () => void;
}

export const SubtitlePanel: React.FC<Props> = ({
  styleConfig,
  onStyleConfigChange,
  onViewAssCode,
}) => {
  const update = (patch: Partial<SubtitleStyleConfig>) => {
    onStyleConfigChange({ ...styleConfig, ...patch });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Type className="w-4 h-4 text-amber-400" /> Kinetic Typography & Styling
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Configure real-time animated typography and export-ready ASS subtitle scripts.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="p-1 rounded-xl bg-zinc-950 border border-zinc-850 grid grid-cols-2 gap-1 text-xs">
        <button
          onClick={() => update({ mode: 'kinetic-word' })}
          className={`px-3 py-2 rounded-lg font-medium transition-all text-left flex flex-col gap-0.5 ${
            styleConfig.mode === 'kinetic-word'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span className="font-semibold text-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Mode A: Kinetic
          </span>
          <span className="text-[10px] text-zinc-500">Word-by-word pop & highlight</span>
        </button>

        <button
          onClick={() => update({ mode: 'cinematic-phrase' })}
          className={`px-3 py-2 rounded-lg font-medium transition-all text-left flex flex-col gap-0.5 ${
            styleConfig.mode === 'cinematic-phrase'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span className="font-semibold text-xs flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Mode B: Cinematic
          </span>
          <span className="text-[10px] text-zinc-500">Smooth phrase-level fades</span>
        </button>
      </div>

      {/* Typography Controls */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3 text-xs">
        <h4 className="font-semibold text-zinc-200 flex items-center gap-1.5 pb-2 border-b border-zinc-850">
          <Palette className="w-3.5 h-3.5 text-zinc-400" /> Typography & Colors
        </h4>

        {/* Font Family & Weight */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-zinc-400 text-[11px] block mb-1">Font Family</label>
            <select
              value={styleConfig.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 rounded px-2.5 py-1 text-xs outline-none"
            >
              <option value="Montserrat, sans-serif">Montserrat (Modern)</option>
              <option value="Impact, sans-serif">Impact (Bold Bold)</option>
              <option value="Inter, sans-serif">Inter (Clean)</option>
              <option value="Arial, sans-serif">Arial (Classic)</option>
              <option value="Trebuchet MS, sans-serif">Trebuchet MS (Editorial)</option>
            </select>
          </div>

          <div>
            <label className="text-zinc-400 text-[11px] block mb-1">Font Weight</label>
            <select
              value={styleConfig.fontWeight}
              onChange={(e) => update({ fontWeight: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-750 text-zinc-200 rounded px-2.5 py-1 text-xs outline-none"
            >
              <option value="normal">Normal (400)</option>
              <option value="bold">Bold (700)</option>
              <option value="800">Extra Bold (800)</option>
              <option value="900">Black (900)</option>
            </select>
          </div>
        </div>

        {/* Font Size Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400 text-[11px]">
            <span>Font Size:</span>
            <span className="font-mono text-zinc-200">{styleConfig.fontSize} px</span>
          </div>
          <input
            type="range"
            min={18}
            max={72}
            value={styleConfig.fontSize}
            onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        {/* Color Pickers */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-zinc-400 text-[11px] block mb-1">Base Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={styleConfig.textColor}
                onChange={(e) => update({ textColor: e.target.value })}
                className="w-8 h-8 rounded border border-zinc-700 bg-transparent cursor-pointer p-0.5"
              />
              <span className="font-mono text-zinc-300 text-xs uppercase">{styleConfig.textColor}</span>
            </div>
          </div>

          <div>
            <label className="text-zinc-400 text-[11px] block mb-1">Active Highlight Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={styleConfig.highlightColor}
                onChange={(e) => update({ highlightColor: e.target.value })}
                className="w-8 h-8 rounded border border-zinc-700 bg-transparent cursor-pointer p-0.5"
              />
              <span className="font-mono text-amber-300 text-xs uppercase">{styleConfig.highlightColor}</span>
            </div>
          </div>
        </div>

        {/* Outline & Shadow */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <div className="flex justify-between text-zinc-400 text-[11px]">
              <span>Outline Width:</span>
              <span className="font-mono text-zinc-200">{styleConfig.outlineWidth} px</span>
            </div>
            <input
              type="range"
              min={0}
              max={8}
              value={styleConfig.outlineWidth}
              onChange={(e) => update({ outlineWidth: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-zinc-400 text-[11px]">
              <span>Shadow Depth:</span>
              <span className="font-mono text-zinc-200">{styleConfig.shadowDepth} px</span>
            </div>
            <input
              type="range"
              min={0}
              max={8}
              value={styleConfig.shadowDepth}
              onChange={(e) => update({ shadowDepth: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Animation & Positioning */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3 text-xs">
        <h4 className="font-semibold text-zinc-200 flex items-center gap-1.5 pb-2 border-b border-zinc-850">
          <Sliders className="w-3.5 h-3.5 text-zinc-400" /> Kinetic Effects & Placement
        </h4>

        {/* Screen Position */}
        <div className="grid grid-cols-3 gap-2">
          {(['bottom', 'center', 'top'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => update({ position: pos })}
              className={`py-1.5 rounded-lg border text-center font-medium capitalize transition-all ${
                styleConfig.position === pos
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-zinc-900 border-zinc-750 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Vertical Margin */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400 text-[11px]">
            <span>Safe Margin:</span>
            <span className="font-mono text-zinc-200">{styleConfig.verticalMargin} px</span>
          </div>
          <input
            type="range"
            min={20}
            max={200}
            value={styleConfig.verticalMargin}
            onChange={(e) => update({ verticalMargin: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        {/* Toggles */}
        <div className="pt-2 border-t border-zinc-850 space-y-2">
          <label className="flex items-center justify-between text-zinc-300 cursor-pointer">
            <span>Pop-in Scale Animation</span>
            <input
              type="checkbox"
              checked={styleConfig.popAnimation}
              onChange={(e) => update({ popAnimation: e.target.checked })}
              className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-zinc-300 cursor-pointer">
            <span>Dynamic Word Glow</span>
            <input
              type="checkbox"
              checked={styleConfig.glowEffect}
              onChange={(e) => update({ glowEffect: e.target.checked })}
              className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* ASS Inspector Action */}
      <button
        onClick={onViewAssCode}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-750 transition-colors"
      >
        <Code className="w-3.5 h-3.5 text-zinc-400" />
        <span>Inspect Compiled ASS Script</span>
      </button>
    </div>
  );
};
