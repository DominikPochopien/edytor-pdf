import type { RecentFileEntry, RecentFilesStore } from '../../application/ports';
import { BYTES_PER_MIB } from '../../domain/units';
import { openDatabase, requestToPromise, STORES, transactionDone } from './indexedDb';

/** How many files the welcome screen remembers. */
export const MAX_RECENT_FILES = 8;
/** Bigger files are listed only while their handle is usable; their bytes are not copied. */
const MAX_REMEMBERED_MIB = 100;
export const MAX_REMEMBERED_BYTES = MAX_REMEMBERED_MIB * BYTES_PER_MIB;

interface StoredData {
  readonly bytes?: Uint8Array;
  readonly handle?: unknown;
}

function newId(): string {
  return crypto.randomUUID();
}

export class IdbRecentFilesStore implements RecentFilesStore {
  async list(): Promise<readonly RecentFileEntry[]> {
    const db = await openDatabase();
    const tx = db.transaction(STORES.recentFiles, 'readonly');
    const entries = await requestToPromise<RecentFileEntry[]>(
      tx.objectStore(STORES.recentFiles).getAll() as IDBRequest<RecentFileEntry[]>,
    );
    return [...entries].sort((a, b) => b.openedAt - a.openedAt);
  }

  async remember(name: string, bytes: Uint8Array, handle?: unknown): Promise<void> {
    const existing = (await this.list()).filter((entry) => entry.name === name);
    for (const entry of existing) {
      await this.remove(entry.id);
    }
    const db = await openDatabase();
    const tx = db.transaction([STORES.recentFiles, STORES.recentFileData], 'readwrite');
    const entry: RecentFileEntry = {
      id: newId(),
      name,
      size: bytes.byteLength,
      openedAt: Date.now(),
    };
    const data: StoredData =
      bytes.byteLength <= MAX_REMEMBERED_BYTES ? { bytes, handle } : { handle };
    tx.objectStore(STORES.recentFiles).put(entry);
    tx.objectStore(STORES.recentFileData).put(data, entry.id);
    await transactionDone(tx);
    await this.trim();
  }

  async load(id: string): Promise<{
    readonly name: string;
    readonly bytes: Uint8Array;
    readonly handle?: unknown;
  } | null> {
    const db = await openDatabase();
    const tx = db.transaction([STORES.recentFiles, STORES.recentFileData], 'readonly');
    const entry = await requestToPromise<RecentFileEntry | undefined>(
      tx.objectStore(STORES.recentFiles).get(id) as IDBRequest<RecentFileEntry | undefined>,
    );
    const data = await requestToPromise<StoredData | undefined>(
      tx.objectStore(STORES.recentFileData).get(id) as IDBRequest<StoredData | undefined>,
    );
    if (entry === undefined || data === undefined) {
      return null;
    }
    if (data.bytes !== undefined) {
      return { name: entry.name, bytes: data.bytes, handle: data.handle };
    }
    const bytes = await this.readFromHandle(data.handle);
    return bytes === null ? null : { name: entry.name, bytes, handle: data.handle };
  }

  async remove(id: string): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction([STORES.recentFiles, STORES.recentFileData], 'readwrite');
    tx.objectStore(STORES.recentFiles).delete(id);
    tx.objectStore(STORES.recentFileData).delete(id);
    await transactionDone(tx);
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction([STORES.recentFiles, STORES.recentFileData], 'readwrite');
    tx.objectStore(STORES.recentFiles).clear();
    tx.objectStore(STORES.recentFileData).clear();
    await transactionDone(tx);
  }

  private async trim(): Promise<void> {
    const entries = await this.list();
    for (const entry of entries.slice(MAX_RECENT_FILES)) {
      await this.remove(entry.id);
    }
  }

  private async readFromHandle(handle: unknown): Promise<Uint8Array | null> {
    if (!(typeof FileSystemFileHandle !== 'undefined' && handle instanceof FileSystemFileHandle)) {
      return null;
    }
    try {
      const file = await handle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return null;
    }
  }
}
