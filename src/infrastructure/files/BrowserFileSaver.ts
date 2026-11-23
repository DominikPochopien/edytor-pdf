import type { FileSaver, SaveOutcome } from '../../application/ports';

const PDF_TYPE = 'application/pdf';
/** Object URLs of downloads are released after the browser has started the download. */
const DOWNLOAD_URL_LIFETIME_MS = 60_000;

type PermissionMode = 'read' | 'readwrite';

interface WritableHandle {
  readonly name: string;
  queryPermission?: (options: { mode: PermissionMode }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: PermissionMode }) => Promise<PermissionState>;
  createWritable: () => Promise<{
    write: (data: BufferSource) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface SavePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, readonly string[]> }[];
  }) => Promise<WritableHandle>;
}

function isWritableHandle(value: unknown): value is WritableHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'createWritable' in value &&
    typeof value.createWritable === 'function'
  );
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

/**
 * Saving files: in Chrome and Edge directly to disk (File System Access API), elsewhere as a
 * normal download. Nothing ever leaves the computer.
 */
export class BrowserFileSaver implements FileSaver {
  constructor(private readonly typeDescription: string) {}

  get canSaveInPlace(): boolean {
    return this.picker() !== undefined;
  }

  async saveToHandle(
    handle: unknown,
    bytes: Uint8Array,
    name: string,
  ): Promise<SaveOutcome | null> {
    if (!isWritableHandle(handle)) {
      return null;
    }
    const mode = { mode: 'readwrite' } as const;
    const granted =
      (await handle.queryPermission?.(mode)) === 'granted' ||
      (await handle.requestPermission?.(mode)) === 'granted';
    if (!granted) {
      return null;
    }
    await this.write(handle, bytes);
    return { method: 'file', name: handle.name || name, handle };
  }

  async saveAs(bytes: Uint8Array, suggestedName: string): Promise<SaveOutcome | null> {
    const picker = this.picker();
    if (picker === undefined) {
      this.download(bytes, suggestedName);
      return { method: 'download', name: suggestedName };
    }
    let handle: WritableHandle;
    try {
      handle = await picker({
        suggestedName,
        types: [{ description: this.typeDescription, accept: { [PDF_TYPE]: ['.pdf'] } }],
      });
    } catch (error) {
      if (isAbort(error)) {
        return null;
      }
      throw error;
    }
    await this.write(handle, bytes);
    return { method: 'file', name: handle.name, handle };
  }

  private picker(): SavePickerWindow['showSaveFilePicker'] {
    return (window as unknown as SavePickerWindow).showSaveFilePicker;
  }

  private async write(handle: WritableHandle, bytes: Uint8Array): Promise<void> {
    const writable = await handle.createWritable();
    await writable.write(asArrayBuffer(bytes));
    await writable.close();
  }

  private download(bytes: Uint8Array, name: string): void {
    const url = URL.createObjectURL(new Blob([asArrayBuffer(bytes)], { type: PDF_TYPE }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, DOWNLOAD_URL_LIFETIME_MS);
  }
}
