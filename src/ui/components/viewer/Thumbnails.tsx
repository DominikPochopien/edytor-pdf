import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { computeLayout, RenderPriority, visiblePageRange } from '../../../application/viewer';
import type { DocumentId } from '../../../domain/document';
import { displaySize } from '../../../domain/geometry';
import { useDevicePixelRatio } from '../../hooks/useDevicePixelRatio';
import { useElementSize } from '../../hooks/useElementSize';
import { usePageBitmap } from '../../hooks/usePageBitmap';
import type { OpenedDocument } from '../../store/viewerStore';
import { useViewerStore } from '../../store/viewerStore';

const THUMB_WIDTH = 120;
/** Space under each thumbnail for the page number. */
const LABEL_SPACE = 28;
const PADDING = 12;
const OVERSCAN = 3;

interface ThumbnailProps {
  readonly documentId: DocumentId;
  readonly pageIndex: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly current: boolean;
}

function Thumbnail({ documentId, pageIndex, top, width, height, scale, current }: ThumbnailProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = usePageBitmap(documentId, pageIndex, scale, RenderPriority.thumbnail);
  const goToPage = useViewerStore((s) => s.goToPage);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (state.status !== 'ready' || canvas === null) {
      return;
    }
    try {
      canvas.width = state.bitmap.width;
      canvas.height = state.bitmap.height;
      canvas.getContext('2d')?.drawImage(state.bitmap.image, 0, 0);
    } catch {
      // Released from the cache meanwhile; it will be requested again when needed.
    }
  }, [state]);

  return (
    <button
      type="button"
      aria-label={t('sidebar.pageThumbnail', { page: pageIndex + 1 })}
      aria-current={current ? 'page' : undefined}
      data-testid={`thumbnail-${pageIndex}`}
      onClick={() => {
        goToPage(pageIndex);
      }}
      className="group absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1"
      style={{ top }}
    >
      <span
        className="block bg-white shadow ring-2 ring-transparent group-hover:ring-neutral-300 group-aria-[current=page]:ring-accent-500"
        style={{ width, height }}
      >
        <canvas ref={canvasRef} aria-hidden className="size-full" />
      </span>
      <span className="text-xs text-neutral-600 tabular-nums group-aria-[current=page]:font-semibold group-aria-[current=page]:text-accent-700 dark:text-neutral-300 dark:group-aria-[current=page]:text-accent-100">
        {pageIndex + 1}
      </span>
    </button>
  );
}

export function Thumbnails({ document }: { readonly document: OpenedDocument }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = useElementSize(containerRef);
  const devicePixelRatio = useDevicePixelRatio();
  const currentPage = useViewerStore((s) => s.currentPage);
  const [scrollTop, setScrollTop] = useState(0);
  const { info } = document;

  const sizes = useMemo(
    () =>
      info.pages.map((page) => {
        const size = displaySize(page.cropBox, page.rotation);
        const factor = THUMB_WIDTH / size.width;
        return { width: size.width * factor, height: size.height * factor, factor };
      }),
    [info],
  );
  const layout = useMemo(
    () => computeLayout(sizes, 1, { gap: LABEL_SPACE, padding: PADDING }),
    [sizes],
  );

  // Keep the current page's thumbnail in view while the document scrolls.
  useEffect(() => {
    const element = containerRef.current;
    const slot = layout.slots[currentPage];
    if (element === null || slot === undefined) {
      return;
    }
    const bottom = slot.top + slot.height + LABEL_SPACE;
    if (slot.top < element.scrollTop || bottom > element.scrollTop + element.clientHeight) {
      element.scrollTop = slot.top - PADDING;
    }
  }, [currentPage, layout]);

  const range = visiblePageRange(layout, scrollTop, viewport.height, OVERSCAN);
  const items = [];
  if (range !== null) {
    for (let index = range.first; index <= range.last; index++) {
      const slot = layout.slots[index];
      const size = sizes[index];
      if (slot !== undefined && size !== undefined) {
        items.push(
          <Thumbnail
            key={index}
            documentId={info.id}
            pageIndex={index}
            top={slot.top}
            width={slot.width}
            height={slot.height}
            scale={size.factor * devicePixelRatio}
            current={index === currentPage}
          />,
        );
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto"
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
      }}
    >
      <div className="relative" style={{ height: layout.totalHeight }}>
        {items}
      </div>
    </div>
  );
}
