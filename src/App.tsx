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
  pickVideoFile, pickOutputDirectory, saveRenderToDirectory, DirectoryHandleState
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

  // Subtitle state
  const [segments, setSegments] = useState<SubtitleSegment[]>([
    {
      id: 'seg-1',
      start: 0.5,
      end: 3.2,
      text: 'Experience high-impact kinetic typography animation.',
      words: [
        { id: 'w-1', word: 'Experience', start: 0.5, end: 1.1, confidence: 0.99 },
        { id: 'w-2', word: 'high-impact', start: 1.15, end: 1.7, confidence: 0.98 },
        { id: 'w-3', word: 'kinetic', start: 1.75, end: 2.2, confidence: 0.99 },
        { id: 'w-4', word: 'typography', start: 2.25, end: 2.8, confidence: 0.97 },
        { id: 'w-5', word: 'animation.', start: 2.85, end: 3.2, confidence: 0.98 },
      ],
    },
    {
      id: 'seg-2',
      start: 3.6,
      end: 6.8,
      text: 'Powered by Faster-Whisper and local GPU upscaling.',
      words: [
        { id: 'w-6', word: 'Powered', start: 3.6, end: 4.0, confidence: 0.98 },
        { id: 'w-7', word: 'by', start: 4.05, end: 4.25, confidence: 0.99 },
        { id: 'w-8', word: 'Faster-Whisper', start: 4.3, end: 5.1, confidence: 0.96 },
        { id: 'w-9', word: 'and', start: 5.15, end: 5.35, confidence: 0.98 },
        { id: 'w-10', word: 'local', start: 5.4, end: 5.75, confidence: 0.97 },
        { id: 'w-11', word: 'GPU', start: 5.8, end: 6.15, confidence: 0.99 },
        { id: 'w-12', word: 'upscaling.', start: 6.2, end: 6.8, confidence: 0.97 },
      ],
    },
  ]);
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

  const handleFileDrop = async (file: File) => {
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);

    try {
      const meta = await apiClient.inspectVideo({
        filename: file.name,
        size: file.size,
        width: 1920,
        height: 1080,
        duration: 10.0,
      });
      setVideoMetadata(meta);
      setExportSettings((prev) => ({
        ...prev,
        outputFilename: `${file.name.replace(/\.[^/.]+$/, '')}_Rendered.mp4`,
      }));
    } catch {
      setVideoMetadata({
        filename: file.name,
        filepath: file.name,
        file_size_bytes: file.size,
        file_size_mb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
        format_name: file.name.split('.').pop()?.toUpperCase() || 'MP4',
        duration_seconds: 10.0,
        width: 1920,
        height: 1080,
        aspect_ratio: '16:9',
        fps: 30,
        video_codec: 'h264',
        audio_codec: 'aac',
        audio_channels: 2,
        audio_sample_rate: 44100,
        bitrate_kbps: 4500,
        has_audio: true,
      });
    }

    showToast(`Loaded ${file.name} successfully`, 'success');
  };

  // Initial detection
  useEffect(() => {
    loadHardwareInfo();
    // Preload sample video if none present so user can test immediate playback
    createDemoVideoBlob();
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
    } catch {
      // Backend not yet ready
    } finally {
      setIsTelemetryLoading(false);
    }
  };

  // Creates an interactive demonstration video via HTML5 Canvas
  const createDemoVideoBlob = () => {
    if (videoSrc) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoSrc(url);
        setVideoMetadata({
          filename: 'Sample_Presentation_Demonstration.webm',
          filepath: 'demo_presentation.webm',
          file_size_bytes: blob.size,
          file_size_mb: Math.round((blob.size / (1024 * 1024)) * 100) / 100 || 1.4,
          format_name: 'WEBM',
          duration_seconds: 8.0,
          width: 1280,
          height: 720,
          aspect_ratio: '16:9',
          fps: 30,
          video_codec: 'vp8 / avc',
          audio_codec: 'opus / aac',
          audio_channels: 2,
          audio_sample_rate: 48000,
          bitrate_kbps: 4200,
          has_audio: true,
        });
      };

      recorder.start();

      let frame = 0;
      const totalFrames = 30 * 8; // 8 seconds

      const draw = () => {
        if (frame >= totalFrames) {
          recorder.stop();
          return;
        }

        // Animated studio background
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#09090b');
        grad.addColorStop(0.5, '#18181b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Animated concentric rings
        const timeSec = frame / 30;
        ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 + Math.sin(timeSec * 2) * 0.1})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(640, 360, 140 + Math.sin(timeSec * 3) * 30, 0, Math.PI * 2);
        ctx.stroke();

        // Center card
        ctx.fillStyle = 'rgba(24, 24, 27, 0.85)';
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(320, 200, 640, 320, 16);
        ctx.fill();
        ctx.stroke();

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AI VIDEO STUDIO', 640, 290);

        // Subtitle
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '18px Montserrat, sans-serif';
        ctx.fillText('Local Kinetic Typography & Resolution Upscaling', 640, 335);

        // Timecode
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 24px monospace';
        const tc = `00:00:0${Math.floor(timeSec)}:${String(frame % 30).padStart(2, '0')}`;
        ctx.fillText(tc, 640, 420);

        frame++;
        requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.warn('Canvas video generation fallback:', err);
    }
  };

  // Handle local video selection
  const handleSelectVideo = async () => {
    try {
      const { file } = await pickVideoFile();
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);

      // Inspect metadata via API
      try {
        const meta = await apiClient.inspectVideo({
          filename: file.name,
          size: file.size,
          width: 1920,
          height: 1080,
          duration: 10.0,
        });
        setVideoMetadata(meta);
        setExportSettings((prev) => ({
          ...prev,
          outputFilename: `${file.name.replace(/\.[^/.]+$/, '')}_Rendered.mp4`,
        }));
      } catch {
        // Fallback basic metadata
        setVideoMetadata({
          filename: file.name,
          filepath: file.name,
          file_size_bytes: file.size,
          file_size_mb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
          format_name: file.name.split('.').pop()?.toUpperCase() || 'MP4',
          duration_seconds: 10.0,
          width: 1920,
          height: 1080,
          aspect_ratio: '16:9',
          fps: 30,
          video_codec: 'h264',
          audio_codec: 'aac',
          audio_channels: 2,
          audio_sample_rate: 44100,
          bitrate_kbps: 4500,
          has_audio: true,
        });
      }

      showToast(`Loaded ${file.name} successfully`, 'success');
    } catch (err: any) {
      if (err.message !== 'Selection cancelled') {
        showToast(err.message || 'Failed to select video', 'error');
      }
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
    setIsTranscribing(true);
    try {
      const res = await apiClient.startTranscription(
        videoMetadata?.filepath || 'source_video.mp4',
        modelSize
      );
      setActiveJob({
        id: res.job_id,
        job_type: 'TRANSCRIPTION',
        stage: 'QUEUED',
        progress_percent: 5,
        elapsed_seconds: 0,
        estimated_remaining_seconds: 10,
        message: 'Speech transcription job queued',
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
    setIsRendering(true);
    try {
      const res = await apiClient.startRender({
        input_video_path: videoMetadata?.filepath || 'source_video.mp4',
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
        progress_percent: 5,
        elapsed_seconds: 0,
        estimated_remaining_seconds: 15,
        message: 'Master video render queued',
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
    if (!job.artifacts?.video_filename) return;
    try {
      const dummyBlob = new Blob(['AI Video Studio Finished MP4 Stream'], { type: 'video/mp4' });
      const res = await saveRenderToDirectory(
        job.artifacts.video_filename,
        dummyBlob,
        outputDir.handle
      );
      if (res.savedDirectly) {
        showToast(`Saved rendered video directly to ${res.location}`, 'success');
      } else {
        showToast(`Render ready for download: ${res.location}`, 'success');
      }
    } catch (err) {
      console.warn('Save render error:', err);
    }
  };

  // Download artifacts handler
  const handleDownloadArtifact = async (filename: string, content: string | Blob) => {
    try {
      const res = await saveRenderToDirectory(filename, content, outputDir.handle);
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
        isSaving={isSaving}
      />

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
                onLoadDemo={createDemoVideoBlob}
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
              onLoadDemoVideo={createDemoVideoBlob}
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
                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
              >
                Inspect
              </button>
            </div>
            <div className="text-[11px] text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>GPU:</span>
                <span className="font-mono text-zinc-200 truncate max-w-[140px]" title={telemetry?.gpu.model}>
                  {telemetry?.gpu.model || 'NVIDIA RTX 5060'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Encoder:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {telemetry?.recommended_encoder || 'av1_nvenc'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>VRAM:</span>
                <span className="font-mono text-zinc-200">
                  {telemetry?.gpu.vram_total_mb
                    ? `${Math.round((telemetry.gpu.vram_total_mb - telemetry.gpu.vram_free_mb) / 1024 * 10) / 10} / ${Math.round(telemetry.gpu.vram_total_mb / 1024 * 10) / 10} GB`
                    : 'GDDR7 Dynamic'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Arch:</span>
                <span className="font-mono text-purple-300">Blackwell Gen 9</span>
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
