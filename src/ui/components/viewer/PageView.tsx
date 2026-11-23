import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { PageSlot } from '../../../application/viewer';
import type { DocumentId, SearchHit } from '../../../domain/document';
import { usePageBitmap } from '../../hooks/usePageBitmap';
import { LinkLayer } from './LinkLayer';
import { TextLayer } from './TextLayer';

interface PageViewProps {
  readonly documentId: DocumentId;
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly slot: PageSlot;
  readonly left: number;
  /** Zoom used for layout (changes immediately). */
  readonly zoom: number;
  /** Device pixels per point used for rendering (changes after zooming stops). */
  readonly renderScale: number;
  readonly priority: number;
  readonly hits: readonly { readonly hit: SearchHit; readonly active: boolean }[];
}

export function PageView(props: PageViewProps) {
  const { documentId, pageIndex, pageCount, slot, left, zoom, renderScale, priority, hits } = props;
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = usePageBitmap(documentId, pageIndex, renderScale, priority);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (state.status !== 'ready' || canvas === null) {
      return;
    }
    const { bitmap } = state;
    try {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')?.drawImage(bitmap.image, 0, 0);
      canvas.dataset.rendered = 'true';
    } catch {
      // The bitmap was released from the cache in the meantime; the next render replaces it.
    }
  }, [state]);

  return (
    <div
      role="region"
      aria-label={t('page.label', { page: pageIndex + 1, count: pageCount })}
      data-page-index={pageIndex}
      className="absolute bg-white shadow-md ring-1 ring-black/5"
      style={{ top: slot.top, left, width: slot.width, height: slot.height }}
    >
      {/* The canvas keeps the previous bitmap (stretched) while a sharper one renders. */}
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
      {state.status === 'loading' && (
        <span className="sr-only">{t('page.loading', { page: pageIndex + 1 })}</span>
      )}
      {state.status === 'error' && (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-700">
          {t('page.renderError')}
        </p>
      )}
      <TextLayer documentId={documentId} pageIndex={pageIndex} zoom={zoom} />
      {hits.map(({ hit, active }) =>
        hit.rects.map((rect) => (
          <div
            key={`${rect.x},${rect.y},${rect.width}`}
            className="search-hit"
            data-active={active}
            style={{
              left: rect.x * zoom,
              top: rect.y * zoom,
              width: rect.width * zoom,
              height: rect.height * zoom,
            }}
          />
        )),
      )}
      <LinkLayer documentId={documentId} pageIndex={pageIndex} zoom={zoom} />
    </div>
  );
}
