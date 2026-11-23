import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentLayout } from '../../../application/viewer';
import {
  computeLayout,
  currentPageIndex,
  fitPageZoom,
  fitWidthZoom,
  pageIndexAtOffset,
  RenderPriority,
  scrollTopForPage,
  visiblePageRange,
  zoomFromWheel,
} from '../../../application/viewer';
import type { SearchHit } from '../../../domain/document';
import { displaySize } from '../../../domain/geometry';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDevicePixelRatio } from '../../hooks/useDevicePixelRatio';
import { useElementSize } from '../../hooks/useElementSize';
import type { OpenedDocument } from '../../store/viewerStore';
import { useViewerStore } from '../../store/viewerStore';
import { PageView } from './PageView';

const PAGE_GAP = 16;
const PADDING = 24;
const OVERSCAN_PAGES = 1;
/** Rendering waits until zooming stops; until then the old bitmap is stretched. */
const RENDER_ZOOM_DELAY_MS = 150;
/** A search hit is scrolled to this fraction of the viewport height. */
const FOCUS_POSITION = 0.33;

interface Anchor {
  readonly x: number;
  readonly y: number;
}

interface DocumentViewProps {
  readonly document: OpenedDocument;
}

export function DocumentView({ document }: DocumentViewProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = useElementSize(containerRef);
  const devicePixelRatio = useDevicePixelRatio();
  const zoom = useViewerStore((s) => s.zoom);
  const zoomMode = useViewerStore((s) => s.zoomMode);
  const scrollRequest = useViewerStore((s) => s.scrollRequest);
  const search = useViewerStore((s) => s.search);
  const renderZoom = useDebouncedValue(zoom, RENDER_ZOOM_DELAY_MS);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<Anchor | null>(null);
  const previousLayoutRef = useRef<DocumentLayout | null>(null);
  const layoutRef = useRef<DocumentLayout | null>(null);

  const { info } = document;
  const pageSizes = useMemo(
    () => info.pages.map((page) => displaySize(page.cropBox, page.rotation)),
    [info],
  );
  const layout = useMemo(
    () => computeLayout(pageSizes, zoom, { gap: PAGE_GAP, padding: PADDING }),
    [pageSizes, zoom],
  );

  useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // "Fit width" and "fit page" follow the window size.
  useEffect(() => {
    if (viewport.width === 0 || zoomMode === 'custom') {
      return;
    }
    const { setZoom, currentPage } = useViewerStore.getState();
    const page = pageSizes[currentPage] ?? pageSizes[0];
    const fitted =
      zoomMode === 'fit-width' || page === undefined
        ? fitWidthZoom(pageSizes, viewport, PADDING)
        : fitPageZoom(page, viewport, PADDING);
    setZoom(fitted, zoomMode);
  }, [zoomMode, viewport, pageSizes]);

  // Keep the point under the mouse (or the middle of the view) in place when zooming.
  useLayoutEffect(() => {
    const element = containerRef.current;
    const previous = previousLayoutRef.current;
    previousLayoutRef.current = layout;
    if (element === null || previous === null || previous === layout) {
      return;
    }
    const explicitAnchor = anchorRef.current;
    anchorRef.current = null;
    if (explicitAnchor === null && element.scrollTop === 0) {
      // At the top of the document (e.g. right after opening) zooming keeps the first page in view.
      return;
    }
    const anchor = explicitAnchor ?? { x: element.clientWidth / 2, y: element.clientHeight / 2 };
    const documentY = element.scrollTop + anchor.y;
    const index = pageIndexAtOffset(previous, documentY);
    const oldSlot = previous.slots[index];
    const newSlot = layout.slots[index];
    if (oldSlot === undefined || newSlot === undefined) {
      return;
    }
    const fraction = (documentY - oldSlot.top) / oldSlot.height;
    element.scrollTop = newSlot.top + fraction * newSlot.height - anchor.y;
    const ratioX =
      previous.totalWidth > 0 ? (element.scrollLeft + anchor.x) / previous.totalWidth : 0;
    element.scrollLeft = ratioX * layout.totalWidth - anchor.x;
    setScroll({ top: element.scrollTop, left: element.scrollLeft });
  }, [layout]);

  // Ctrl + mouse wheel (or trackpad pinch) zooms the document instead of the whole page.
  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return undefined;
    }
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      anchorRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const store = useViewerStore.getState();
      store.setZoom(zoomFromWheel(store.zoom, event.deltaY));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Requests from thumbnails, "go to page" and search.
  useEffect(() => {
    const element = containerRef.current;
    const currentLayout = layoutRef.current;
    if (element === null || scrollRequest === null || currentLayout === null) {
      return;
    }
    // Only new requests scroll; zoom changes are handled by the anchor logic above.
    const pageTop = scrollTopForPage(currentLayout, scrollRequest.pageIndex, PADDING);
    const focus =
      scrollRequest.focusTop === undefined
        ? 0
        : PADDING +
          scrollRequest.focusTop * useViewerStore.getState().zoom -
          element.clientHeight * FOCUS_POSITION;
    element.scrollTop = Math.max(0, pageTop + focus);
  }, [scrollRequest]);

  const onScroll = (): void => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }
    setScroll({ top: element.scrollTop, left: element.scrollLeft });
    useViewerStore
      .getState()
      .setCurrentPage(currentPageIndex(layout, element.scrollTop, element.clientHeight));
  };

  const range = visiblePageRange(layout, scroll.top, viewport.height, OVERSCAN_PAGES);
  const strictRange = visiblePageRange(layout, scroll.top, viewport.height, 0);
  const innerWidth = Math.max(layout.totalWidth, viewport.width);
  const hitsByPage = useMemo(() => {
    const map = new Map<number, { hit: SearchHit; active: boolean }[]>();
    search.result?.hits.forEach((hit, index) => {
      const list = map.get(hit.pageIndex) ?? [];
      list.push({ hit, active: index === search.activeHit });
      map.set(hit.pageIndex, list);
    });
    return map;
  }, [search.result, search.activeHit]);

  const pages = [];
  if (range !== null) {
    for (let index = range.first; index <= range.last; index++) {
      const slot = layout.slots[index];
      if (slot === undefined) {
        continue;
      }
      const visible =
        strictRange !== null && index >= strictRange.first && index <= strictRange.last;
      pages.push(
        <PageView
          key={index}
          documentId={info.id}
          pageIndex={index}
          pageCount={info.pages.length}
          slot={slot}
          left={(innerWidth - slot.width) / 2}
          zoom={zoom}
          renderScale={renderZoom * devicePixelRatio}
          priority={visible ? RenderPriority.visiblePage : RenderPriority.nearbyPage}
          hits={hitsByPage.get(index) ?? []}
        />,
      );
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      tabIndex={0}
      role="document"
      aria-label={t('app.name')}
      data-testid="document-view"
      className="relative min-w-0 flex-1 overflow-auto bg-neutral-200 outline-none dark:bg-neutral-950"
    >
      <div className="relative" style={{ height: layout.totalHeight, width: innerWidth }}>
        {pages}
      </div>
    </div>
  );
}
