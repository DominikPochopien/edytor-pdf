/** A file chosen by the user. `handle` is an opaque browser handle used later for "Zapisz". */
export interface PickedFile {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly handle?: unknown;
}

export interface FileAccess {
  /** Shows the system "open file" dialog. Resolves with null when the user cancels. */
  pickPdfFile(): Promise<PickedFile | null>;
  /** Reads a file that was dropped on the page or passed by the operating system. */
  readFile(file: File): Promise<PickedFile>;
}

/** How a file reached the user's disk. */
export type SaveMethod = 'file' | 'download';

export interface SaveOutcome {
  readonly method: SaveMethod;
  readonly name: string;
  /** Handle of the written file, when the browser can write files directly (Chrome, Edge). */
  readonly handle?: unknown;
}

export interface FileSaver {
  /** True when "Zapisz" can overwrite the opened file (File System Access API). */
  readonly canSaveInPlace: boolean;
  /**
   * Writes over the file behind `handle`. The browser asks the user for permission the first
   * time. Resolves with null when the user refuses or the handle cannot be used any more.
   */
  saveToHandle(handle: unknown, bytes: Uint8Array, name: string): Promise<SaveOutcome | null>;
  /** "Zapisz jako": always a new file. Resolves with null when the user cancels. */
  saveAs(bytes: Uint8Array, suggestedName: string): Promise<SaveOutcome | null>;
}
