/**
 * AI Video Studio — Master Application
 * Local Video Production Studio for Windows
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { MediaPanel } from './components/panels/MediaPanel';
import { SpeechPanel } from './components/panels/SpeechPanel';
import { SubtitlePanel } from './components/panels/SubtitlePanel';
import { EnhancementPanel } from './components/panels/EnhancementPanel';
import { ExportPanel } from './components/panels/ExportPanel';
import { SettingsPanel } from './components/panels/SettingsPanel';
import { JobQueuePanel } from './components/JobQueuePanel';
import { HardwareModal } from './components/HardwareModal';
import { LaunchGuideModal } from './components/LaunchGuideModal';
import { AssCodeModal } from './components/AssCodeModal';
import { ProjectsModal } from './components/ProjectsModal';

import { apiClient } from './services/apiClient';
import {
  VideoMetadata, HardwareTelemetry, ProcessingJob, ExportSettings, ProjectData
} from './types';
import {
  SubtitleSegment, SubtitleStyleConfig, DEFAULT_SUBTITLE_STYLE, generateAss, groupWordsIntoSegments
} from './utils/subtitleParser';
import {
  EnhancementConfig, DEFAULT_ENHANCEMENT
} from './utils/enhancementEngine';
import {
  pickVideoFile, pickOutputDirectory, saveRenderToDirectory, DirectoryHandleState,
  isDirectoryPickerSupported, verifyPermission
} from './utils/fileSystemAccess';

import {
  Film, Mic, Type, Sparkles, Video, HardDrive, CheckCircle2, AlertCircle, Settings
} from 'lucide-react';

export default function App() {
  // Navigation tabs
  type TabType = 'media' | 'speech' | 'subtitles' | 'enhancement' | 'export' | 'settings';
  const [activeTab, setActiveTab] = useState<TabType>('media');

  // Project state
  const [projectId, setProjectId] = useState<string>('default-project');
  const [projectName, setProjectName] = useState<string>('My Video Reel');
  const [isSaving, setIsSaving] = useState(false);

  // Video & Playback state
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(10.0);

  // Subtitle state (real transcribed segments, no fake demo words)
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyleConfig>(DEFAULT_SUBTITLE_STYLE);

  // Enhancement state
  const [enhancement, setEnhancement] = useState<EnhancementConfig>(DEFAULT_ENHANCEMENT);

  // Export settings
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    width: 1920,
    height: 1080,
    fps: 30,
    videoCodec: 'auto',
    audioCodec: 'copy',
    qualityCrf: 20,
    outputFilename: 'AI_Video_Studio_Export.mp4',
  });

  // Output folder state
  const [outputDir, setOutputDir] = useState<DirectoryHandleState>({
    handle: null,
    name: null,
    hasPermission: false,
  });

  // Jobs state
  const [activeJob, setActiveJob] = useState<ProcessingJob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  // System & Connection state
  const [telemetry, setTelemetry] = useState<HardwareTelemetry | null>(null);
  const [isPythonEngine, setIsPythonEngine] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [isTelemetryLoading, setIsTelemetryLoading] = useState(false);

  // Modals state
  const [isHardwareOpen, setIsHardwareOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAssModalOpen, setIsAssModalOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [compiledAssCode, setCompiledAssCode] = useState<string>('');

  // Status toast message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLoadProject = (proj: ProjectData) => {
    setProjectId(proj.id);
    setProjectName(proj.name);
    if (proj.segments) setSegments(proj.segments);
    if (proj.subtitleStyle) setSubtitleStyle(proj.subtitleStyle);
    if (proj.enhancement) setEnhancement(proj.enhancement);
    if (proj.exportSettings) setExportSettings(proj.exportSettings);
    if (proj.videoMetadata) setVideoMetadata(proj.videoMetadata);
    showToast(`Loaded project: ${proj.name}`, 'success');
  };

  const processUploadedVideo = async (file: File) => {
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);

    showToast(`Uploading ${file.name} to local engine...`, 'info');
    try {
      const meta = await apiClient.uploadVideo(file);
      setVideoMetadata(meta);
      if (meta.duration_seconds) {
        setDuration(meta.duration_seconds);
      }
      setExportSettings((prev) => ({
        ...prev,
        width: meta.width || prev.width,
        height: meta.height || prev.height,
        fps: meta.fps ? Math.round(meta.fps) : prev.fps,
        outputFilename: `${file.name.replace(/\.[^/.]+$/, '')}_Rendered.mp4`,
      }));
      showToast(`Uploaded & inspected ${file.name} successfully`, 'success');
    } catch (err: any) {
      setVideoMetadata(null);
      showToast(`Upload/inspection failed: ${err.message}`, 'error');
    }
  };

  const handleFileDrop = async (file: File) => {
    await processUploadedVideo(file);
  };

  // Handle local video selection
  const handleSelectVideo = async () => {
    try {
      const { file } = await pickVideoFile();
      await processUploadedVideo(file);
    } catch (err: any) {
      if (err.message !== 'Selection cancelled') {
        showToast(err.message || 'Failed to select video', 'error');
      }
    }
  };

  // Initial detection
  useEffect(() => {
    loadHardwareInfo();
  }, []);

  // Poll active job status
  useEffect(() => {
    if (!activeJob || activeJob.stage === 'COMPLETED' || activeJob.stage === 'FAILED' || activeJob.stage === 'CANCELLED') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await apiClient.getJobStatus(activeJob.id);
        setActiveJob(updated);

        if (updated.stage === 'COMPLETED') {
          setIsTranscribing(false);
          setIsRendering(false);
          showToast(`Job ${updated.job_type} finished successfully!`, 'success');

          if (updated.job_type === 'TRANSCRIPTION' && updated.result?.segments) {
            setSegments(updated.result.segments);
          }

          // If render completed and we have an output directory handle, save directly
          if (updated.job_type === 'RENDER' && updated.artifacts) {
            saveRenderResultDirectly(updated);
          }
        } else if (updated.stage === 'FAILED' || updated.stage === 'CANCELLED') {
          setIsTranscribing(false);
          setIsRendering(false);
          showToast(`Job ${updated.stage.toLowerCase()}: ${updated.error || updated.message}`, 'error');
        }
      } catch (err) {
        console.warn('Job polling error:', err);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [activeJob]);

  const loadHardwareInfo = async () => {
    setIsTelemetryLoading(true);
    try {
      const detect = await apiClient.detectBackend();
      setIsPythonEngine(detect.isPython);
      const data = await apiClient.getSystemInfo();
      setTelemetry(data);
      setIsBackendConnected(true);
    } catch (err: any) {
      console.warn('Backend connection error:', err);
      setIsBackendConnected(false);
      setIsPythonEngine(false);
      setTelemetry(null);
    } finally {
      setIsTelemetryLoading(false);
    }
  };

  // Handle Select Output Folder
  const handleSelectOutputDirectory = async () => {
    try {
      const dirState = await pickOutputDirectory();
      if (dirState.hasPermission && dirState.name) {
        setOutputDir(dirState);
        showToast(`Output folder set to: ${dirState.name}`, 'success');
      } else {
        showToast('Directory permission was not granted.', 'error');
      }
    } catch (err: any) {
      if (err.message !== 'Directory selection cancelled') {
        showToast(err.message || 'Could not select directory', 'error');
      }
    }
  };

  // Start speech transcription
  const handleStartTranscription = async (modelSize: string) => {
    if (!videoMetadata?.filepath) {
      showToast('Please upload a video before starting transcription.', 'error');
      return;
    }
    setIsTranscribing(true);
    try {
      const res = await apiClient.startTranscription(
        videoMetadata.filepath,
        modelSize
      );
      setActiveJob({
        id: res.job_id,
        job_type: 'TRANSCRIPTION',
        stage: 'QUEUED',
        progress_percent: 0,
        elapsed_seconds: 0,
        estimated_remaining_seconds: null,
        message: 'Speech transcription job queued in backend engine',
      });
      showToast('Faster-Whisper speech analysis started', 'info');
    } catch (err: any) {
      setIsTranscribing(false);
      showToast(err.message || 'Failed to start transcription', 'error');
    }
  };

  // Inspect ASS Code Modal
  const handleViewAssCode = () => {
    const code = generateAss(segments, subtitleStyle, exportSettings.width, exportSettings.height);
    setCompiledAssCode(code);
    setIsAssModalOpen(true);
  };

  // Start Video Rendering
  const handleStartRender = async () => {
    if (!videoMetadata?.filepath) {
      showToast('Please upload a video before starting render.', 'error');
      return;
    }
    if (segments.length === 0) {
      showToast('Please transcribe speech or create subtitle segments before rendering.', 'error');
      return;
    }
    setIsRendering(true);
    try {
      const res = await apiClient.startRender({
        input_video_path: videoMetadata.filepath,
        segments,
        subtitle_style: subtitleStyle,
        enhancement,
        export_settings: exportSettings,
        output_filename: exportSettings.outputFilename,
      });

      setActiveJob({
        id: res.job_id,
        job_type: 'RENDER',
        stage: 'QUEUED',
        progress_percent: 0,
        elapsed_seconds: 0,
        estimated_remaining_seconds: null,
        message: 'Master video render job queued in backend engine',
      });
      showToast('Render job submitted to engine', 'info');
    } catch (err: any) {
      setIsRendering(false);
      showToast(err.message || 'Failed to initiate render', 'error');
    }
  };

  // Cancel Job
  const handleCancelJob = async (jobId: string) => {
    try {
      await apiClient.cancelJob(jobId);
      setActiveJob((prev) => (prev ? { ...prev, stage: 'CANCELLED', message: 'Cancelled by user' } : null));
      setIsRendering(false);
      setIsTranscribing(false);
      showToast('Job cancelled', 'info');
    } catch (err: any) {
      showToast(err.message || 'Could not cancel job', 'error');
    }
  };

  // Save render directly using File System Access API
  const saveRenderResultDirectly = async (job: ProcessingJob) => {
    if (!job.artifacts?.video_filename || !job.artifacts?.video_url) return;
    try {
      showToast(`Fetching rendered video from local engine...`, 'info');
      const videoFetchUrl = `${apiClient.getBaseUrl()}${job.artifacts.video_url}`;
      const response = await fetch(videoFetchUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch rendered video: ${response.status} ${response.statusText}`);
      }

      if (outputDir.handle && isDirectoryPickerSupported() && response.body) {
        const hasPerm = await verifyPermission(outputDir.handle, true);
        if (hasPerm) {
          const fileHandle = await outputDir.handle.getFileHandle(job.artifacts.video_filename, { create: true });
          const writable = await fileHandle.createWritable();
          await response.body.pipeTo(writable);
          showToast(`Saved rendered video directly to ${outputDir.name}/${job.artifacts.video_filename}`, 'success');
          return;
        }
      }

      // Fallback
      const videoBlob = await response.blob();
      const res = await saveRenderToDirectory(
        job.artifacts.video_filename,
        videoBlob,
        outputDir.handle
      );
      if (res.savedDirectly) {
        showToast(`Saved rendered video directly to ${res.location}`, 'success');
      } else {
        showToast(`Render ready for download: ${res.location}`, 'success');
      }
    } catch (err: any) {
      console.warn('Save render error:', err);
      showToast(`Error saving render: ${err.message}`, 'error');
    }
  };

  // Download artifacts handler
  const handleDownloadArtifact = async (filename: string, content: string | Blob) => {
    try {
      let dataToSave = content;
      if (typeof content === 'string' && (content.startsWith('/') || content.startsWith('http'))) {
        const fetchUrl = content.startsWith('http') ? content : `${apiClient.getBaseUrl()}${content}`;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`Failed to download artifact: ${res.statusText}`);
        dataToSave = await res.blob();
      }
      const res = await saveRenderToDirectory(filename, dataToSave, outputDir.handle);
      if (res.savedDirectly) {
        showToast(`Saved ${filename} to ${outputDir.name}`, 'success');
      } else {
        showToast(`Downloaded ${filename}`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Download failed', 'error');
    }
  };

  // Project save
  const handleSaveProject = async () => {
    setIsSaving(true);
    try {
      const proj: ProjectData = {
        id: projectId,
        name: projectName,
        updatedAt: new Date().toISOString(),
        videoMetadata,
        segments,
        subtitleStyle,
        enhancement,
        exportSettings,
      };
      await apiClient.saveProject(proj);
      showToast('Project saved successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save project', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewProject = () => {
    setProjectId('proj_' + Math.random().toString(36).substring(2, 9));
    setProjectName('Untitled Video');
    setSegments([]);
    setVideoMetadata(null);
    setVideoSrc(null);
    showToast('Created new project', 'info');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div
          className={`fixed top-16 right-6 z-50 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
              : toastMessage.type === 'error'
              ? 'bg-red-950 text-red-300 border-red-500/40'
              : 'bg-indigo-950 text-indigo-300 border-indigo-500/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Studio Header */}
      <Header
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onNewProject={handleNewProject}
        onSaveProject={handleSaveProject}
        onOpenProject={() => setIsProjectsOpen(true)}
        onOpenHardware={() => setIsHardwareOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenSettings={() => setActiveTab('settings')}
        telemetry={telemetry}
        isPythonEngine={isPythonEngine}
        isBackendConnected={isBackendConnected}
        isSaving={isSaving}
      />

      {/* Backend Disconnected Warning Banner */}
      {!isBackendConnected && isBackendConnected !== null && (
        <div className="bg-red-950/90 border-b border-red-500/40 px-4 py-2 text-xs flex flex-wrap items-center justify-between text-red-200 gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>LOCAL BACKEND DISCONNECTED:</strong> The Python FastAPI engine (port 8000) is offline.
              Launch it on your PC using <code className="bg-red-900/60 px-1.5 py-0.5 rounded font-mono text-red-100 font-semibold">START_AI_VIDEO_STUDIO.bat</code>.
            </span>
          </div>
          <button
            onClick={loadHardwareInfo}
            disabled={isTelemetryLoading}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Studio Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Contextual Tools Sidebar */}
        <div className="w-full md:w-80 lg:w-96 border-r border-zinc-800 bg-zinc-925 flex flex-col shrink-0">
          {/* Workflow Tabs Navigation */}
          <div className="flex border-b border-zinc-800 bg-zinc-950 text-xs font-medium">
            {[
              { id: 'media', label: 'Media', icon: Film },
              { id: 'speech', label: 'Speech', icon: Mic },
              { id: 'subtitles', label: 'Kinetic', icon: Type },
              { id: 'enhancement', label: 'Upscale', icon: Sparkles },
              { id: 'export', label: 'Export', icon: Video },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex-1 py-3 flex flex-col items-center gap-1 border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60 font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] sm:text-[11px]">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'media' && (
              <MediaPanel
                metadata={videoMetadata}
                onSelectVideo={handleSelectVideo}
                onLoadDemo={handleSelectVideo}
                onFileDrop={handleFileDrop}
              />
            )}
            {activeTab === 'speech' && (
              <SpeechPanel
                segments={segments}
                onSegmentsChange={setSegments}
                onStartTranscription={handleStartTranscription}
                isTranscribing={isTranscribing}
                onSeek={setCurrentTime}
                currentTime={currentTime}
              />
            )}
            {activeTab === 'subtitles' && (
              <SubtitlePanel
                styleConfig={subtitleStyle}
                onStyleConfigChange={setSubtitleStyle}
                onViewAssCode={handleViewAssCode}
              />
            )}
            {activeTab === 'enhancement' && (
              <EnhancementPanel
                config={enhancement}
                onChange={setEnhancement}
                onPreviewRefresh={() => showToast('Enhancement filter updated', 'info')}
                isGeneratingPreview={false}
              />
            )}
            {activeTab === 'export' && (
              <ExportPanel
                settings={exportSettings}
                onChange={setExportSettings}
                outputDirectoryName={outputDir.name}
                onSelectOutputDirectory={handleSelectOutputDirectory}
                onStartRender={handleStartRender}
                isRendering={isRendering}
                canRender={segments.length > 0}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsPanel
                telemetry={telemetry}
                onRefreshTelemetry={loadHardwareInfo}
                preferredEncoder={exportSettings.videoCodec}
                onEncoderChange={(enc) => setExportSettings((prev) => ({ ...prev, videoCodec: enc as ExportSettings['videoCodec'] }))}
                onShowToast={showToast}
              />
            )}
          </div>
        </div>

        {/* Center Canvas: Video Player & Multi-Track Timeline */}
        <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
          {/* Main Video Viewport */}
          <div className="flex-1 p-3 flex flex-col min-h-0">
            <VideoPlayer
              videoSrc={videoSrc}
              segments={segments}
              subtitleStyle={subtitleStyle}
              enhancement={enhancement}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
              onSelectVideo={handleSelectVideo}
              onLoadDemoVideo={handleSelectVideo}
            />
          </div>

          {/* Multi-Track Scrub Timeline */}
          <div className="shrink-0">
            <Timeline
              duration={duration}
              currentTime={currentTime}
              segments={segments}
              onSeek={setCurrentTime}
            />
          </div>
        </div>

        {/* Right Sidebar: Real-Time Engine Queue & Telemetry */}
        <div className="w-full md:w-72 lg:w-80 border-l border-zinc-800 bg-zinc-925 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
          <div>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Engine Processing Queue
            </h3>
            <JobQueuePanel
              activeJob={activeJob}
              onCancelJob={handleCancelJob}
              onDownloadArtifact={handleDownloadArtifact}
            />
          </div>

          {/* Quick Hardware Status Card */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-850">
              <span className="font-semibold text-zinc-300">GPU & Hardware Stats</span>
              <button
                onClick={() => setIsHardwareOpen(true)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                Inspect
              </button>
            </div>
            <div className="text-[11px] text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>GPU:</span>
                <span className="font-mono text-zinc-200 truncate max-w-[140px]" title={telemetry?.gpu.model}>
                  {telemetry?.gpu.detected ? telemetry.gpu.model : 'CPU Mode (No GPU)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Encoder:</span>
                <span className={`font-mono font-semibold ${telemetry?.recommended_encoder?.includes('nvenc') ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  {telemetry?.recommended_encoder || 'libx264'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>VRAM:</span>
                <span className="font-mono text-zinc-200">
                  {telemetry?.gpu.detected && telemetry.gpu.vram_total_mb > 0
                    ? `${Math.round((telemetry.gpu.vram_total_mb - telemetry.gpu.vram_free_mb) / 1024 * 10) / 10} / ${Math.round(telemetry.gpu.vram_total_mb / 1024 * 10) / 10} GB`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Arch:</span>
                <span className="font-mono text-purple-300">
                  {telemetry?.gpu.detected
                    ? (telemetry.gpu.is_blackwell ? 'Blackwell Gen 9' : (telemetry.cuda?.arch_compatibility || 'NVIDIA CUDA'))
                    : 'Host CPU'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <HardwareModal
        isOpen={isHardwareOpen}
        onClose={() => setIsHardwareOpen(false)}
        telemetry={telemetry}
        onRefresh={loadHardwareInfo}
        isLoading={isTelemetryLoading}
      />

      <LaunchGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      <AssCodeModal
        isOpen={isAssModalOpen}
        onClose={() => setIsAssModalOpen(false)}
        assCode={compiledAssCode}
      />

      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        onLoadProject={handleLoadProject}
        onNewProject={handleNewProject}
        currentProjectId={projectId}
        onShowToast={showToast}
      />
    </div>
  );
}
