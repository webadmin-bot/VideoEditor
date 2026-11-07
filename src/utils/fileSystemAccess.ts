/**
 * Browser File System Access API wrapper
 * Safely manages local file picking and direct output directory saving.
 */

export interface DirectoryHandleState {
  handle: any | null;
  name: string | null;
  hasPermission: boolean;
}

/**
 * Checks if the browser supports window.showDirectoryPicker
 */
export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Checks if the browser supports window.showOpenFilePicker
 */
export function isFilePickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/**
 * Prompts user to pick a video file using File System Access API or fallback
 */
export async function pickVideoFile(): Promise<{ file: File; handle?: any }> {
  if (isFilePickerSupported()) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Video Files (*.mp4, *.mov, *.mkv, *.avi, *.webm)',
            accept: {
              'video/*': ['.mp4', '.mov', '.mkv', '.avi', '.webm'],
            },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      return { file, handle };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Selection cancelled');
      }
      // If permission or feature failed, bubble up
      throw err;
    }
  }

  // Fallback to hidden file input
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/quicktime,video/x-matroska,video/x-msvideo,video/webm,.mp4,.mov,.mkv,.avi,.webm';
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        resolve({ file: input.files[0] });
      } else {
        reject(new Error('Selection cancelled'));
      }
    };
    input.click();
  });
}

/**
 * Prompts user to select an output directory using showDirectoryPicker
 */
export async function pickOutputDirectory(): Promise<DirectoryHandleState> {
  if (!isDirectoryPickerSupported()) {
    throw new Error('Directory selection is not supported in this browser. Downloads will fall back to browser save dialog.');
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });

    // Verify permission
    const permission = await verifyPermission(dirHandle, true);
    if (!permission) {
      return { handle: null, name: null, hasPermission: false };
    }

    return {
      handle: dirHandle,
      name: dirHandle.name,
      hasPermission: true,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Directory selection cancelled');
    }
    throw err;
  }
}

/**
 * Verifies or requests readwrite permission for a stored directory handle
 */
export async function verifyPermission(fileHandle: any, readWrite: boolean): Promise<boolean> {
  const options: any = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}

/**
 * Saves a file directly to the selected directory handle using a writable stream,
 * or falls back to traditional download blob if no handle or unsupported.
 */
export async function saveRenderToDirectory(
  filename: string,
  data: Blob | string,
  dirHandle?: any
): Promise<{ savedDirectly: boolean; location: string }> {
  const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data;

  if (dirHandle && isDirectoryPickerSupported()) {
    try {
      const hasPerm = await verifyPermission(dirHandle, true);
      if (hasPerm) {
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return {
          savedDirectly: true,
          location: `${dirHandle.name}/${filename}`,
        };
      }
    } catch (err) {
      console.warn('Could not write directly to directory handle, falling back to browser download:', err);
    }
  }

  // Fallback: Browser download trigger
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return {
    savedDirectly: false,
    location: `Downloads / ${filename}`,
  };
}
