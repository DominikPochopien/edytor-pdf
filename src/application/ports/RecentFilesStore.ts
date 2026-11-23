export interface RecentFileEntry {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly openedAt: number;
}

/** Recently opened files, stored only in this browser (IndexedDB). */
export interface RecentFilesStore {
  list(): Promise<readonly RecentFileEntry[]>;
  remember(name: string, bytes: Uint8Array, handle?: unknown): Promise<void>;
  load(id: string): Promise<{
    readonly name: string;
    readonly bytes: Uint8Array;
    readonly handle?: unknown;
  } | null>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
