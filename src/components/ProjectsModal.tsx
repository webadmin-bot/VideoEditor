import React, { useState, useEffect } from 'react';
import {
  FolderOpen, Plus, Trash2, Download, Upload, Clock, Film, Type, X, CheckCircle2, AlertCircle
} from 'lucide-react';
import { ProjectData } from '../types';
import { apiClient } from '../services/apiClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: ProjectData) => void;
  onNewProject: () => void;
  currentProjectId: string;
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const ProjectsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onLoadProject,
  onNewProject,
  currentProjectId,
  onShowToast,
}) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.listProjects();
      setProjects(data || []);
    } catch {
      // Fallback empty
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"?`)) return;
    try {
      await apiClient.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      onShowToast(`Deleted project: ${name}`, 'info');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to delete project', 'error');
    }
  };

  const handleExportJson = (project: ProjectData) => {
    try {
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_project.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast(`Exported ${project.name} to JSON`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Export error', 'error');
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string) as ProjectData;
        if (!parsed.id || !parsed.name) {
          throw new Error('Invalid project file schema: missing id or name');
        }
        await apiClient.saveProject(parsed);
        setProjects((prev) => [parsed, ...prev.filter((p) => p.id !== parsed.id)]);
        onShowToast(`Imported project: ${parsed.name}`, 'success');
      } catch (err: any) {
        onShowToast(`Failed to parse project file: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-925 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Project Management</h2>
              <p className="text-[11px] text-zinc-400">Manage saved video reels, subtitles, and hardware rendering profiles</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>Import JSON</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <button
              onClick={() => {
                onNewProject();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-zinc-500">Loading saved projects...</div>
          ) : projects.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-800 rounded-xl text-center space-y-2">
              <FolderOpen className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs font-medium text-zinc-300">No saved projects yet</p>
              <p className="text-[11px] text-zinc-500">
                Projects saved from the top header bar will appear here in local storage.
              </p>
            </div>
          ) : (
            projects.map((proj) => {
              const isCurrent = proj.id === currentProjectId;
              const segCount = proj.segments?.length || 0;
              const dateStr = proj.updatedAt
                ? new Date(proj.updatedAt).toLocaleDateString() + ' ' + new Date(proj.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Recent';

              return (
                <div
                  key={proj.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    isCurrent
                      ? 'bg-indigo-950/20 border-indigo-500/40 ring-1 ring-indigo-500/30'
                      : 'bg-zinc-950 border-zinc-850 hover:border-zinc-750'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-zinc-200 truncate">{proj.name}</h4>
                      {isCurrent && (
                        <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>{dateStr}</span>
                      </span>
                      {proj.videoMetadata?.filename && (
                        <span className="flex items-center gap-1 truncate max-w-[150px]" title={proj.videoMetadata.filename}>
                          <Film className="w-3 h-3 text-zinc-500" />
                          <span>{proj.videoMetadata.filename}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Type className="w-3 h-3 text-zinc-500" />
                        <span>{segCount} Subtitles</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleExportJson(proj)}
                      title="Download Project JSON"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(proj.id, proj.name)}
                      title="Delete Project"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        onLoadProject(proj);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors cursor-pointer"
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400">
          <span>Saved to: <code className="text-zinc-300 font-mono">/storage/projects/*.json</code></span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
