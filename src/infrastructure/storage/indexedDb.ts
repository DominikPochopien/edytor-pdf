export const DATABASE_NAME = 'edytor-pdf';
const DATABASE_VERSION = 1;

export const STORES = {
  recentFiles: 'recent-files',
  recentFileData: 'recent-file-data',
} as const;

let databasePromise: Promise<IDBDatabase> | null = null;

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result);
    });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    });
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => {
      resolve();
    });
    transaction.addEventListener('error', () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
    transaction.addEventListener('abort', () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  });
}

/** Opens (and if needed creates) the app database. Everything stays in this browser. */
export function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.recentFiles)) {
        db.createObjectStore(STORES.recentFiles, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.recentFileData)) {
        db.createObjectStore(STORES.recentFileData);
      }
    });
    request.addEventListener('success', () => {
      resolve(request.result);
    });
    request.addEventListener('error', () => {
      databasePromise = null;
      reject(request.error ?? new Error('Cannot open IndexedDB'));
    });
  });
  return databasePromise;
}

/** Closes and forgets the cached connection (used by tests before deleting the database). */
export async function closeDatabase(): Promise<void> {
  const pending = databasePromise;
  databasePromise = null;
  if (pending !== null) {
    (await pending).close();
  }
}
