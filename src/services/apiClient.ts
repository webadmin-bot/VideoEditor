import { HardwareTelemetry, VideoMetadata, ProcessingJob, ExportSettings, ProjectData } from '../types';
import { SubtitleSegment, SubtitleStyleConfig } from '../utils/subtitleParser';
import { EnhancementConfig } from '../utils/enhancementEngine';

class ApiClient {
  private activeBase = '';
  private isConnectedToPython = false;

  constructor() {
    this.detectBackend();
  }

  public async detectBackend(): Promise<{ isPython: boolean; url: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch('/api/health', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.isConnectedToPython = true;
        this.activeBase = '';
        return { isPython: true, url: typeof window !== 'undefined' ? window.location.origin : '' };
      }
    } catch {
      // Backend offline or unreachable
    }

    this.activeBase = '';
    this.isConnectedToPython = false;
    return { isPython: false, url: '' };
  }

  private sessionToken = '';

  public setSessionToken(token: string) {
    this.sessionToken = token;
  }

  public getConnectedStatus(): { isPython: boolean; baseUrl: string } {
    return {
      isPython: this.isConnectedToPython,
      baseUrl: this.activeBase || (typeof window !== 'undefined' ? window.location.origin : ''),
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.activeBase}${endpoint}`;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(this.sessionToken ? { 'X-Studio-Token': this.sessionToken } : {}),
        ...((options.headers as Record<string, string>) || {}),
      };

      const res = await fetch(url, {
        ...options,
        headers,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error (${res.status}): ${errorText}`);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      throw err;
    }
  }

  public async getHealth(): Promise<{ status: string; service: string }> {
    return this.request('/api/health');
  }

  public async getSystemInfo(): Promise<HardwareTelemetry> {
    return this.request('/api/system/info');
  }

  public async getModelsStatus(): Promise<any> {
    return this.request('/api/models/status');
  }

  public getBaseUrl(): string {
    return this.activeBase || (typeof window !== 'undefined' ? window.location.origin : '');
  }

  public async uploadVideo(file: File): Promise<VideoMetadata> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.activeBase}/api/video/upload`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errDetail = errorText;
      try {
        const parsed = JSON.parse(errorText);
        errDetail = parsed.detail || parsed.error || errorText;
      } catch {}
      throw new Error(`Upload Failed (${res.status}): ${errDetail}`);
    }

    return (await res.json()) as VideoMetadata;
  }

  public async inspectVideo(payload: {
    filepath?: string;
    filename?: string;
    size?: number;
    duration?: number;
    width?: number;
    height?: number;
  }): Promise<VideoMetadata> {
    return this.request('/api/video/inspect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async startTranscription(videoPath: string, modelSize = 'base'): Promise<{ job_id: string; stage: string }> {
    return this.request('/api/transcription/start', {
      method: 'POST',
      body: JSON.stringify({ video_path: videoPath, model_size: modelSize }),
    });
  }

  public async generateSubtitles(
    segments: SubtitleSegment[],
    style: SubtitleStyleConfig,
    videoWidth = 1920,
    videoHeight = 1080
  ): Promise<{ success: boolean; srt_content: string; ass_content: string; srt_path?: string; ass_path?: string }> {
    return this.request('/api/subtitles/generate', {
      method: 'POST',
      body: JSON.stringify({
        segments,
        style,
        video_width: videoWidth,
        video_height: videoHeight,
      }),
    });
  }

  public async previewEnhancement(
    videoPath: string,
    enhancement: EnhancementConfig
  ): Promise<{ success: boolean; filters_applied: string; original_base64?: string; enhanced_base64?: string }> {
    return this.request('/api/enhancement/preview', {
      method: 'POST',
      body: JSON.stringify({ video_path: videoPath, enhancement }),
    });
  }

  public async startRender(payload: {
    input_video_path: string;
    segments: SubtitleSegment[];
    subtitle_style: SubtitleStyleConfig;
    enhancement: EnhancementConfig;
    export_settings: ExportSettings;
    output_filename?: string;
  }): Promise<{ job_id: string; stage: string; output_filename: string }> {
    return this.request('/api/render/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getJobStatus(jobId: string): Promise<ProcessingJob> {
    return this.request(`/api/jobs/${jobId}`);
  }

  public async cancelJob(jobId: string): Promise<{ success: boolean }> {
    return this.request(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
  }

  public async listProjects(): Promise<ProjectData[]> {
    return this.request('/api/projects');
  }

  public async saveProject(project: ProjectData): Promise<ProjectData> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  public async deleteProject(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/projects/${id}`, { method: 'DELETE' });
  }

  public async testConnection(targetUrl?: string): Promise<{ success: boolean; latency_ms: number; service?: string }> {
    const t0 = performance.now();
    const url = (targetUrl || this.activeBase || window.location.origin) + '/api/health';
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const latency = Math.round(performance.now() - t0);
      if (res.ok) {
        const data = await res.json();
        return { success: true, latency_ms: latency, service: data.service };
      }
      return { success: false, latency_ms: latency };
    } catch {
      return { success: false, latency_ms: Math.round(performance.now() - t0) };
    }
  }

  public async testDiskWrite(targetPath?: string): Promise<{
    success: boolean;
    writable: boolean;
    latency_ms: number;
    target_path: string;
    message: string;
  }> {
    return this.request('/api/filesystem/test-write', {
      method: 'POST',
      body: JSON.stringify({ target_path: targetPath }),
    });
  }

  public async cleanStorage(): Promise<{
    success: boolean;
    deleted_count: number;
    freed_mb: number;
    message: string;
  }> {
    return this.request('/api/storage/clean', {
      method: 'POST',
    });
  }

  public async analyzeScene(
    videoPathOrName: string,
    transcriptSummary: string = '',
    uploadId?: string
  ): Promise<{
    enabled: boolean;
    available?: boolean;
    analysis_text?: string;
    scene_tags: string[];
    visual_highlights: Array<{ timestamp: number; title: string; description: string }>;
    message?: string;
  }> {
    return this.request('/api/ai/analyze-scene', {
      method: 'POST',
      body: JSON.stringify({
        video_path: videoPathOrName,
        upload_id: uploadId,
        video_name: videoPathOrName,
        transcript_summary: transcriptSummary,
      }),
    });
  }
}

export const apiClient = new ApiClient();

