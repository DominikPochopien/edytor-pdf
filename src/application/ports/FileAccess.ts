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
