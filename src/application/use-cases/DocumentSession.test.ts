import { describe, expect, it, vi } from 'vitest';
import type { DocumentInfo } from '../../domain/document';
import type { OpenDocumentResult, PdfDocumentLoader, RecentFilesStore } from '../ports';
import { PageImageService } from '../viewer';
import { DocumentSession } from './DocumentSession';

function info(id: string): DocumentInfo {
  return {
    id,
    pages: [],
    metadata: { title: '', author: '' },
    isEncrypted: false,
    wasRepaired: false,
  };
}

function setup(results: OpenDocumentResult[]) {
  const loader: PdfDocumentLoader = {
    open: vi.fn(() => Promise.resolve(results.shift()!)),
    close: vi.fn(() => Promise.resolve()),
  };
  const recentFiles = {
    remember: vi.fn(() => Promise.resolve()),
  } as unknown as RecentFilesStore;
  const images = new PageImageService({ renderPage: vi.fn() }, { maxCacheBytes: 1 });
  const session = new DocumentSession({ loader, recentFiles, images });
  return { session, loader, recentFiles };
}

const file = { name: 'a.pdf', bytes: new Uint8Array([1]) };

describe('DocumentSession', () => {
  it('opens a document and remembers it', async () => {
    const { session, recentFiles } = setup([{ status: 'opened', document: info('d1') }]);
    const outcome = await session.open(file);
    expect(outcome.status).toBe('opened');
    expect(session.document?.id).toBe('d1');
    expect(recentFiles.remember).toHaveBeenCalledWith('a.pdf', file.bytes, undefined);
  });

  it('closes the previous document only after the new one opened', async () => {
    const { session, loader } = setup([
      { status: 'opened', document: info('d1') },
      { status: 'password-required', wrongPassword: false },
      { status: 'opened', document: info('d2') },
    ]);
    await session.open(file);
    await session.open(file);
    expect(loader.close).not.toHaveBeenCalled();
    expect(session.document?.id).toBe('d1');
    await session.open(file, 'haslo');
    expect(loader.close).toHaveBeenCalledWith('d1');
    expect(session.document?.id).toBe('d2');
  });

  it('keeps working when remembering the file fails', async () => {
    const { session, recentFiles } = setup([{ status: 'opened', document: info('d1') }]);
    vi.mocked(recentFiles.remember).mockRejectedValueOnce(new Error('private mode'));
    await expect(session.open(file)).resolves.toMatchObject({ status: 'opened' });
  });
});
