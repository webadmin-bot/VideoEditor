import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTargetDimensions,
  buildFfmpegFilterString,
  requiresAiModelRunner,
  calculateOptimalTileSize,
  detectBlackwellCompatibility,
  ENHANCEMENT_PRESETS,
  DEFAULT_ENHANCEMENT,
} from './enhancementEngine';

test('getTargetDimensions returns standard 1080p, 2K, 4K landscape dimensions', () => {
  assert.deepEqual(getTargetDimensions('1080p', 1280, 720), { width: 1920, height: 1080 });
  assert.deepEqual(getTargetDimensions('2K', 1920, 1080), { width: 2560, height: 1440 });
  assert.deepEqual(getTargetDimensions('4K', 1920, 1080), { width: 3840, height: 2160 });
  assert.deepEqual(getTargetDimensions('None', 1280, 720), { width: 1280, height: 720 });
});

test('getTargetDimensions respects portrait orientation for vertical videos', () => {
  assert.deepEqual(getTargetDimensions('1080p', 720, 1280), { width: 1080, height: 1920 });
  assert.deepEqual(getTargetDimensions('4K', 1080, 1920), { width: 2160, height: 3840 });
});

test('buildFfmpegFilterString constructs valid eq, unsharp, and hqdn3d filter strings', () => {
  const filterStr = buildFfmpegFilterString({
    ...DEFAULT_ENHANCEMENT,
    denoiseStrength: 20,
    sharpenStrength: 40,
    contrast: 1.1,
    saturation: 1.2,
    brightness: 0.05,
    aiModel: 'None',
  }, { width: 1920, height: 1080 });

  assert.ok(filterStr.includes('hqdn3d=2.0:1.3:4:4'));
  assert.ok(filterStr.includes('eq=contrast=1.10:brightness=0.05:saturation=1.20'));
  assert.ok(filterStr.includes('unsharp=5:5:0.80:5:5:0.0'));
  assert.ok(filterStr.includes('scale=1920:1080:flags=lanczos'));
});

test('requiresAiModelRunner distinguishes AI neural models from pure FFmpeg filters', () => {
  assert.equal(requiresAiModelRunner({
    ...DEFAULT_ENHANCEMENT,
    aiModel: 'Real-ESRGAN-x4',
    enableFaceRestoration: false,
  }), true);

  assert.equal(requiresAiModelRunner({
    ...DEFAULT_ENHANCEMENT,
    aiModel: 'None',
    enableFaceRestoration: false,
  }), false);

  assert.equal(requiresAiModelRunner({
    ...DEFAULT_ENHANCEMENT,
    aiModel: 'None',
    enableFaceRestoration: true,
  }), true);
});

test('ENHANCEMENT_PRESETS are properly defined with all non-custom presets', () => {
  assert.ok(ENHANCEMENT_PRESETS['Natural']);
  assert.ok(ENHANCEMENT_PRESETS['Cinematic']);
  assert.ok(ENHANCEMENT_PRESETS['Sharp and Detailed']);
  assert.ok(ENHANCEMENT_PRESETS['Clean and Smooth']);
});

test('calculateOptimalTileSize dynamically adapts based on available VRAM and resolution', () => {
  // Never assumes fixed VRAM; protects against CUDA OOM
  assert.equal(calculateOptimalTileSize(2000, '4K'), 256);
  assert.equal(calculateOptimalTileSize(7000, '4K'), 512);
  assert.equal(calculateOptimalTileSize(11000, '4K'), 768);
  assert.equal(calculateOptimalTileSize(3500, '1080p'), 256);
  assert.equal(calculateOptimalTileSize(6000, '1080p'), 512);
  assert.equal(calculateOptimalTileSize(9000, '1080p'), 1024);
  assert.equal(calculateOptimalTileSize(0, '1080p'), 256);
});

test('detectBlackwellCompatibility identifies NVIDIA GeForce RTX 5060 and verifies requirements', () => {
  const rtx5060 = detectBlackwellCompatibility('NVIDIA GeForce RTX 5060', '12.8', '2.6.0', '572.16');
  assert.equal(rtx5060.isBlackwell, true);
  assert.equal(rtx5060.isCompatible, true);
  assert.equal(rtx5060.driverVersionStatus, 'compatible');
  assert.ok(rtx5060.architecture.includes('Blackwell'));

  // Outdated driver warning
  const oldDriver = detectBlackwellCompatibility('NVIDIA GeForce RTX 5060', '12.8', '2.6.0', '535.12');
  assert.equal(oldDriver.isBlackwell, true);
  assert.equal(oldDriver.driverVersionStatus, 'update_recommended');
  assert.ok(oldDriver.warning?.includes('570'));

  // Outdated CUDA warning
  const oldCuda = detectBlackwellCompatibility('NVIDIA GeForce RTX 5060', '11.8', '2.0.0', '572.16');
  assert.equal(oldCuda.isBlackwell, true);
  assert.equal(oldCuda.isCompatible, false);
  assert.ok(oldCuda.warning?.includes('CUDA 12.6 or 12.8'));

  // Non-Blackwell GPU
  const olderGpu = detectBlackwellCompatibility('NVIDIA GeForce GTX 1660 Ti', '12.1', '2.2.0', '550.0');
  assert.equal(olderGpu.isBlackwell, false);
});

