import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IdbRecentFilesStore, MAX_RECENT_FILES } from './IdbRecentFilesStore';
import { closeDatabase, DATABASE_NAME } from './indexedDb';

const bytes = (n: number): Uint8Array => new Uint8Array([n, n, n]);

describe('IdbRecentFilesStore', () => {
  beforeEach(async () => {
    await closeDatabase();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DATABASE_NAME);
      request.onsuccess = () => {
        resolve();
      };
    });
  });

  it('remembers files, newest first', async () => {
    const store = new IdbRecentFilesStore();
    await store.remember('a.pdf', bytes(1));
    await new Promise((r) => setTimeout(r, 2));
    await store.remember('b.pdf', bytes(2));
    const list = await store.list();
    expect(list.map((e) => e.name)).toEqual(['b.pdf', 'a.pdf']);
    const loaded = await store.load(list[1]!.id);
    expect(Array.from(loaded!.bytes)).toEqual([1, 1, 1]);
  });

  it('keeps one entry per file name', async () => {
    const store = new IdbRecentFilesStore();
    await store.remember('a.pdf', bytes(1));
    await store.remember('a.pdf', bytes(9));
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(Array.from((await store.load(list[0]!.id))!.bytes)).toEqual([9, 9, 9]);
  });

  it(`keeps at most ${MAX_RECENT_FILES} files`, async () => {
    const store = new IdbRecentFilesStore();
    for (let i = 0; i < MAX_RECENT_FILES + 3; i++) {
      await store.remember(`${i}.pdf`, bytes(i));
    }
    expect(await store.list()).toHaveLength(MAX_RECENT_FILES);
  });

  it('removes and clears', async () => {
    const store = new IdbRecentFilesStore();
    await store.remember('a.pdf', bytes(1));
    await store.remember('b.pdf', bytes(2));
    const [first] = await store.list();
    await store.remove(first!.id);
    expect(await store.list()).toHaveLength(1);
    await store.clear();
    expect(await store.list()).toHaveLength(0);
    expect(await store.load('missing')).toBeNull();
  });
});
