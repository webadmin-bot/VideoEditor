import { SubtitleSegment, SubtitleStyleConfig, WordTimestamp } from '../utils/subtitleParser';
import { EnhancementConfig } from '../utils/enhancementEngine';

export interface VideoMetadata {
  filename: string;
  filepath: string;
  file_size_bytes: number;
  file_size_mb: number;
  format_name: string;
  duration_seconds: number;
  width: number;
  height: number;
  aspect_ratio: string;
  fps: number;
  video_codec: string;
  audio_codec: string;
  audio_channels: number;
  audio_sample_rate: number;
  bitrate_kbps: number;
  thumbnail_base64?: string;
  has_audio: boolean;
  media_url?: string;
  warning?: string;
}

export interface HardwareTelemetry {
  os: string;
  cpu_model: string;
  cpu_cores_physical: number;
  cpu_cores_logical: number;
  ram_total_gb: number;
  ram_available_gb: number;
  ram_percent_used: number;
  gpu: {
    detected: boolean;
    model: string;
    architecture?: string;
    compute_capability?: string;
    is_blackwell?: boolean;
    vram_total_mb: number;
    vram_free_mb: number;
    driver_version: string;
    cuda_version: string;
    compatibility_warning?: string;
  };
  cuda: {
    torch_installed: boolean;
    cuda_available: boolean;
    device_name?: string;
    cuda_version?: string;
    compute_capability?: string;
    arch_compatibility?: string;
  };
  ffmpeg: {
    ffmpeg_available: boolean;
    ffmpeg_path: string;
    ffprobe_available: boolean;
    ffprobe_path: string;
    encoders: string[];
    has_nvenc: boolean;
  };
  recommended_encoder: string;
  recommended_upscale_tile: number;
}

export type JobStage =
  | 'QUEUED'
  | 'VALIDATING'
  | 'ANALYZING'
  | 'TRANSCRIBING'
  | 'ALIGNING'
  | 'GENERATING_SUBTITLES'
  | 'ENHANCING'
  | 'RENDERING'
  | 'VALIDATING_OUTPUT'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ProcessingJob {
  id: string;
  job_type: 'TRANSCRIPTION' | 'RENDER' | 'ENHANCEMENT';
  stage: JobStage;
  progress_percent: number;
  elapsed_seconds: number;
  estimated_remaining_seconds: number | null;
  message: string;
  error?: string | null;
  artifacts?: {
    video_url?: string;
    video_filename?: string;
    srt_content?: string;
    ass_content?: string;
    file_size_mb?: number;
    encoder_used?: string;
    resolution?: string;
    report?: any;
  };
  result?: any;
}

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  videoCodec: 'auto' | 'av1_nvenc' | 'h264_nvenc' | 'hevc_nvenc' | 'libx264' | 'libx265';
  audioCodec: 'copy' | 'aac';
  qualityCrf: number;
  outputFilename: string;
}

export interface ProjectData {
  id: string;
  name: string;
  updatedAt: string;
  videoMetadata?: VideoMetadata | null;
  segments: SubtitleSegment[];
  subtitleStyle: SubtitleStyleConfig;
  enhancement: EnhancementConfig;
  exportSettings: ExportSettings;
}
