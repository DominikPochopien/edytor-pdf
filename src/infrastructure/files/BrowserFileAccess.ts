import { AppError } from '../../application/errors';
import type { FileAccess, PickedFile } from '../../application/ports';
import { BYTES_PER_GIB } from '../../domain/units';

/** Files larger than this are refused before reading: the engine would run out of memory. */
export const MAX_FILE_BYTES = BYTES_PER_GIB;

const PDF_ACCEPT = { 'application/pdf': ['.pdf'] } as const;

interface OpenFilePickerWindow {
  showOpenFilePicker?: (options: {
    types: { description: string; accept: Record<string, readonly string[]> }[];
    excludeAcceptAllOption?: boolean;
    multiple?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export class BrowserFileAccess implements FileAccess {
  constructor(private readonly pickerDescription: string) {}

  async pickPdfFile(): Promise<PickedFile | null> {
    const picker = (window as unknown as OpenFilePickerWindow).showOpenFilePicker;
    if (picker !== undefined) {
      try {
        const [handle] = await picker({
          types: [{ description: this.pickerDescription, accept: PDF_ACCEPT }],
          multiple: false,
        });
        if (handle === undefined) {
          return null;
        }
        const picked = await this.readFile(await handle.getFile());
        return { ...picked, handle };
      } catch (error) {
        if (isAbort(error)) {
          return null;
        }
        throw error;
      }
    }
    const file = await this.pickWithInput();
    return file === null ? null : this.readFile(file);
  }

  async readFile(file: File): Promise<PickedFile> {
    if (file.size > MAX_FILE_BYTES) {
      throw new AppError('file-too-large', `${file.size} bytes`);
    }
    try {
      return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
    } catch (error) {
      throw new AppError('file-read-failed', file.name, { cause: error });
    }
  }

  private pickWithInput(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.addEventListener('change', () => {
        resolve(input.files?.[0] ?? null);
      });
      input.addEventListener('cancel', () => {
        resolve(null);
      });
      input.click();
    });
  }
}
