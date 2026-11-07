/**
 * AI Video Enhancement Engine & FFmpeg Filter Builder
 * Manages presets, custom parameters, and AI model vs filter differentiation.
 */

export type PresetName = 'Natural' | 'Cinematic' | 'Sharp and Detailed' | 'Clean and Smooth' | 'Custom';

export type UpscaleTarget = 'None' | '1080p' | '2K' | '4K';
export type AiModelType = 'None' | 'Real-ESRGAN-x2' | 'Real-ESRGAN-x4' | 'CodeFormer-Face';

export interface EnhancementConfig {
  preset: PresetName;
  // AI Model Controls
  upscaleTarget: UpscaleTarget;
  aiModel: AiModelType;
  enableFaceRestoration: boolean;
  tiledProcessing: boolean;
  tileSize: number; // e.g. 256 or 512 for VRAM protection
  // Conventional Filters
  denoiseStrength: number;       // 0 to 100
  sharpenStrength: number;       // 0 to 100
  contrast: number;              // 0.5 to 1.5 (default 1.0)
  saturation: number;            // 0.0 to 2.0 (default 1.0)
  brightness: number;            // -0.5 to 0.5 (default 0.0)
  stabilization: boolean;
}

export const ENHANCEMENT_PRESETS: Record<Exclude<PresetName, 'Custom'>, Partial<EnhancementConfig>> = {
  Natural: {
    upscaleTarget: '1080p',
    aiModel: 'Real-ESRGAN-x2',
    enableFaceRestoration: false,
    tiledProcessing: true,
    tileSize: 512,
    denoiseStrength: 15,
    sharpenStrength: 20,
    contrast: 1.05,
    saturation: 1.05,
    brightness: 0.0,
    stabilization: false,
  },
  Cinematic: {
    upscaleTarget: '2K',
    aiModel: 'Real-ESRGAN-x2',
    enableFaceRestoration: true,
    tiledProcessing: true,
    tileSize: 512,
    denoiseStrength: 10,
    sharpenStrength: 25,
    contrast: 1.15,
    saturation: 1.1,
    brightness: -0.02,
    stabilization: true,
  },
  'Sharp and Detailed': {
    upscaleTarget: '4K',
    aiModel: 'Real-ESRGAN-x4',
    enableFaceRestoration: false,
    tiledProcessing: true,
    tileSize: 256,
    denoiseStrength: 5,
    sharpenStrength: 65,
    contrast: 1.1,
    saturation: 1.0,
    brightness: 0.0,
    stabilization: false,
  },
  'Clean and Smooth': {
    upscaleTarget: '1080p',
    aiModel: 'Real-ESRGAN-x2',
    enableFaceRestoration: false,
    tiledProcessing: true,
    tileSize: 512,
    denoiseStrength: 45,
    sharpenStrength: 15,
    contrast: 1.02,
    saturation: 0.98,
    brightness: 0.01,
    stabilization: false,
  },
};

export const DEFAULT_ENHANCEMENT: EnhancementConfig = {
  preset: 'Natural',
  upscaleTarget: '1080p',
  aiModel: 'Real-ESRGAN-x2',
  enableFaceRestoration: false,
  tiledProcessing: true,
  tileSize: 512,
  denoiseStrength: 15,
  sharpenStrength: 20,
  contrast: 1.05,
  saturation: 1.05,
  brightness: 0.0,
  stabilization: false,
};

/**
 * Maps upscale target to standard pixel dimensions
 */
export function getTargetDimensions(target: UpscaleTarget, sourceWidth: number, sourceHeight: number): { width: number; height: number } {
  if (target === 'None') return { width: sourceWidth, height: sourceHeight };
  
  const isPortrait = sourceHeight > sourceWidth;
  if (target === '1080p') {
    return isPortrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
  }
  if (target === '2K') {
    return isPortrait ? { width: 1440, height: 2560 } : { width: 2560, height: 1440 };
  }
  if (target === '4K') {
    return isPortrait ? { width: 2160, height: 3840 } : { width: 3840, height: 2160 };
  }
  return { width: sourceWidth, height: sourceHeight };
}

/**
 * Builds an FFmpeg video filter chain (-vf string) for conventional enhancements
 */
export function buildFfmpegFilterString(config: EnhancementConfig, targetDims?: { width: number; height: number }): string {
  const filters: string[] = [];

  // Denoising via hqdn3d
  if (config.denoiseStrength > 0) {
    const luma = (config.denoiseStrength / 10).toFixed(1);
    const chroma = (config.denoiseStrength / 15).toFixed(1);
    filters.push(`hqdn3d=${luma}:${chroma}:4:4`);
  }

  // Color / Contrast / Saturation adjustment via eq filter
  const hasColorAdjust = config.contrast !== 1.0 || config.saturation !== 1.0 || config.brightness !== 0.0;
  if (hasColorAdjust) {
    filters.push(`eq=contrast=${config.contrast.toFixed(2)}:brightness=${config.brightness.toFixed(2)}:saturation=${config.saturation.toFixed(2)}`);
  }

  // Sharpening via unsharp filter
  if (config.sharpenStrength > 0) {
    const amount = (config.sharpenStrength / 50).toFixed(2);
    filters.push(`unsharp=5:5:${amount}:5:5:0.0`);
  }

  // Conventional scaling fallback if no AI model or if resizing to exact dimensions
  if (targetDims && config.aiModel === 'None') {
    filters.push(`scale=${targetDims.width}:${targetDims.height}:flags=lanczos`);
  }

  return filters.join(',');
}

/**
 * Checks if the configuration requires an AI model runner (Real-ESRGAN / CodeFormer)
 */
export function requiresAiModelRunner(config: EnhancementConfig): boolean {
  return config.aiModel !== 'None' || config.enableFaceRestoration;
}

/**
 * Dynamically calculates optimal tile size based on actual detected free VRAM
 * Never assumes fixed VRAM capacity. Protects NVIDIA RTX 5060 against CUDA OOM.
 */
export function calculateOptimalTileSize(vramFreeMb: number, upscaleTarget: UpscaleTarget): number {
  if (vramFreeMb <= 0) return 256; // CPU or unknown safe fallback

  if (upscaleTarget === '4K') {
    if (vramFreeMb >= 10000) return 768;
    if (vramFreeMb >= 6000) return 512;
    return 256;
  }

  // 1080p and 2K
  if (vramFreeMb >= 8000) return 1024;
  if (vramFreeMb >= 4000) return 512;
  return 256;
}

export interface BlackwellCompatibilityInfo {
  isBlackwell: boolean;
  isCompatible: boolean;
  architecture: string;
  driverVersionStatus: 'compatible' | 'update_recommended' | 'unknown';
  warning?: string;
  recommendedPipCommand: string;
}

/**
 * Verifies NVIDIA Blackwell GPU architecture compatibility (RTX 50-series / RTX 5060).
 * Flags older PyTorch or CUDA runtimes that lack native sm_100/sm_120 compilation.
 */
export function detectBlackwellCompatibility(
  gpuModel: string,
  cudaVersion: string = '',
  torchVersion: string = '',
  driverVersion: string = ''
): BlackwellCompatibilityInfo {
  const modelUpper = (gpuModel || '').toUpperCase();
  const isBlackwell = modelUpper.includes('5060') ||
    modelUpper.includes('5070') ||
    modelUpper.includes('5080') ||
    modelUpper.includes('5090') ||
    modelUpper.includes('RTX 50') ||
    modelUpper.includes('BLACKWELL');

  const recommendedPipCommand = 'pip install --upgrade torch torchvision --index-url https://download.pytorch.org/whl/cu128';

  if (!isBlackwell) {
    return {
      isBlackwell: false,
      isCompatible: true,
      architecture: 'Ada Lovelace / Ampere / Standard CUDA',
      driverVersionStatus: 'compatible',
      recommendedPipCommand: 'pip install torch torchvision',
    };
  }

  // Parse CUDA major.minor
  const cudaNum = parseFloat(cudaVersion.replace(/[^0-9.]/g, '')) || 0;
  // Parse driver version (RTX 5060 Blackwell requires 570+ drivers)
  const driverNum = parseFloat(driverVersion.replace(/[^0-9.]/g, '')) || 0;

  let isCompatible = true;
  let warning: string | undefined;
  let driverStatus: 'compatible' | 'update_recommended' | 'unknown' = 'compatible';

  if (driverNum > 0 && driverNum < 570) {
    driverStatus = 'update_recommended';
    warning = `NVIDIA Driver ${driverVersion} detected. RTX 5060 Blackwell requires driver version 570.xx or newer.`;
  }

  if (cudaNum > 0 && cudaNum < 12.6) {
    isCompatible = false;
    warning = `CUDA ${cudaVersion} detected. NVIDIA GeForce RTX 5060 (Blackwell architecture) requires CUDA 12.6 or 12.8 with PyTorch 2.6+. Run: ${recommendedPipCommand}`;
  }

  return {
    isBlackwell: true,
    isCompatible,
    architecture: 'NVIDIA Blackwell (Gen 9 NVENC / 5th Gen Tensor Cores)',
    driverVersionStatus: driverStatus,
    warning,
    recommendedPipCommand,
  };
}
