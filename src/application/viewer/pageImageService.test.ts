import { describe, expect, it, vi } from 'vitest';
import type { PageBitmap, PdfRenderer } from '../ports';
import { PageImageService, quantizeScale, RenderPriority } from './pageImageService';

function fakeBitmap(width: number, height: number): PageBitmap & { disposed: boolean } {
  const bitmap = {
    width,
    height,
    image: {} as CanvasImageSource,
    disposed: false,
    dispose: () => {
      bitmap.disposed = true;
    },
  };
  return bitmap;
}

function fakeRenderer(): PdfRenderer & { calls: number } {
  const renderer = {
    calls: 0,
    renderPage: vi.fn((_id: string, _page: number, scale: number) => {
      renderer.calls += 1;
      return Promise.resolve(fakeBitmap(Math.round(100 * scale), Math.round(100 * scale)));
    }),
  };
  return renderer;
}

describe('PageImageService', () => {
  it('renders once and then serves from the cache', async () => {
    const renderer = fakeRenderer();
    const service = new PageImageService(renderer, { maxCacheBytes: 1e9 });
    const first = await service.request('doc', 0, 1.5, RenderPriority.visiblePage).promise;
    const second = await service.request('doc', 0, 1.5, RenderPriority.visiblePage).promise;
    expect(first).toBe(second);
    expect(renderer.calls).toBe(1);
    expect(service.peek('doc', 0, 1.5)).toBe(first);
  });

  it('releases bitmaps that no longer fit in memory', async () => {
    const renderer = fakeRenderer();
    const onePage = 100 * 100 * 4;
    const service = new PageImageService(renderer, { maxCacheBytes: onePage });
    const a = (await service.request('doc', 0, 1, 0).promise) as PageBitmap & { disposed: boolean };
    await service.request('doc', 1, 1, 0).promise;
    expect(a.disposed).toBe(true);
  });

  it('forgets the pages of a closed document', async () => {
    const renderer = fakeRenderer();
    const service = new PageImageService(renderer, { maxCacheBytes: 1e9 });
    await service.request('doc', 0, 1, 0).promise;
    await service.request('other', 0, 1, 0).promise;
    service.forgetDocument('doc');
    expect(service.peek('doc', 0, 1)).toBeUndefined();
    expect(service.peek('other', 0, 1)).toBeDefined();
  });

  it('rounds render scales', () => {
    expect(quantizeScale(1.23456)).toBe(1.23);
  });
});
