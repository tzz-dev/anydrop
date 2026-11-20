import type { FileSink } from "./webrtc/fileTransfer";

// Files at least this big are streamed straight to disk (when the browser
// supports it) instead of being assembled in memory. Smaller files keep the
// zero-click "download automatically" behavior.
export const STREAM_THRESHOLD_BYTES = 256 * 1024 * 1024;

// Without disk streaming, the whole file has to fit in memory. Beyond this we
// refuse the transfer up front rather than crash the tab halfway through.
export const MAX_IN_MEMORY_BYTES = 512 * 1024 * 1024;

// Minimal shapes for the File System Access API, which isn't in every TS lib
// and is only implemented by Chromium-based desktop browsers.
interface WritableLike {
  write(data: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}
interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
}
type ShowSaveFilePicker = (options?: { suggestedName?: string }) => Promise<FileHandleLike>;

function getPicker(): ShowSaveFilePicker | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker?.bind(window);
}

export function supportsFileStreaming(): boolean {
  return getPicker() !== undefined;
}

// Whether a file of this size should be streamed to a user-chosen location.
export function shouldStreamToDisk(size: number): boolean {
  return size >= STREAM_THRESHOLD_BYTES && supportsFileStreaming();
}

// Whether this browser can receive a file of this size at all.
export function canReceiveSize(size: number): boolean {
  return size <= MAX_IN_MEMORY_BYTES || supportsFileStreaming();
}

// Opens the browser's "save as" dialog and returns a sink writing to the
// chosen file. Must be called directly from a user gesture (a click handler).
// Rejects with an AbortError if the user dismisses the dialog.
export async function pickFileSink(suggestedName: string): Promise<FileSink> {
  const picker = getPicker();
  if (!picker) throw new Error("File System Access API is not available");

  const handle = await picker({ suggestedName });
  const writable = await handle.createWritable();

  let finished = false;
  return {
    write: (chunk) => writable.write(chunk),
    close: async () => {
      if (finished) return;
      finished = true;
      await writable.close();
    },
    abort: async () => {
      if (finished) return;
      finished = true;
      await writable.abort().catch(() => {});
    },
  };
}
