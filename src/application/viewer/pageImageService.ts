import type { DocumentId } from '../../domain/document';
import type { PageBitmap, PdfRenderer } from '../ports';
import { LruCache } from './lruCache';
import type { QueuedTask } from './taskQueue';
import { TaskQueue } from './taskQueue';

const BYTES_PER_PIXEL = 4;
/** Render scales are rounded so that tiny zoom differences reuse the same bitmap. */
const SCALE_PRECISION = 100;

export const RenderPriority = {
  visiblePage: 0,
  nearbyPage: 1,
  thumbnail: 2,
} as const;

export interface PageImageServiceOptions {
  /** Maximum memory used by cached page bitmaps, in bytes. */
  readonly maxCacheBytes: number;
}

export function quantizeScale(scale: number): number {
  return Math.round(scale * SCALE_PRECISION) / SCALE_PRECISION;
}

function cacheKey(id: DocumentId, pageIndex: number, scale: number): string {
  return `${id}|${pageIndex}|${quantizeScale(scale)}`;
}

/**
 * Supplies page bitmaps to the viewer: renders through the engine in priority order and keeps
 * recently used bitmaps in a memory-bounded cache. Evicted bitmaps are released immediately.
 */
export class PageImageService {
  private readonly cache: LruCache<string, PageBitmap>;
  private readonly queue = new TaskQueue();

  constructor(
    private readonly renderer: PdfRenderer,
    options: PageImageServiceOptions,
  ) {
    this.cache = new LruCache<string, PageBitmap>(
      options.maxCacheBytes,
      (bitmap) => bitmap.width * bitmap.height * BYTES_PER_PIXEL,
      (bitmap) => {
        bitmap.dispose();
      },
    );
  }

  /** Returns a cached bitmap without rendering, or undefined. */
  peek(id: DocumentId, pageIndex: number, scale: number): PageBitmap | undefined {
    return this.cache.get(cacheKey(id, pageIndex, scale));
  }

  request(
    id: DocumentId,
    pageIndex: number,
    scale: number,
    priority: number,
  ): QueuedTask<PageBitmap> {
    const key = cacheKey(id, pageIndex, scale);
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return { promise: Promise.resolve(cached), cancel: () => undefined };
    }
    return this.queue.enqueue(key, priority, async () => {
      const bitmap = await this.renderer.renderPage(id, pageIndex, quantizeScale(scale));
      this.cache.set(key, bitmap);
      return bitmap;
    });
  }

  /** Drops every cached bitmap of a document (after closing it or changing its pages). */
  forgetDocument(id: DocumentId): void {
    this.cache.deleteWhere((key) => key.startsWith(`${id}|`));
  }

  /** Drops cached bitmaps of a single page (e.g. after an edit). */
  forgetPage(id: DocumentId, pageIndex: number): void {
    this.cache.deleteWhere((key) => key.startsWith(`${id}|${pageIndex}|`));
  }
}
