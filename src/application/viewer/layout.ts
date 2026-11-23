import type { Size } from '../../domain/geometry';

export interface LayoutOptions {
  /** Vertical gap between pages, in CSS pixels. */
  readonly gap: number;
  /** Padding around all pages, in CSS pixels. */
  readonly padding: number;
}

export interface PageSlot {
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface DocumentLayout {
  readonly slots: readonly PageSlot[];
  readonly totalHeight: number;
  readonly totalWidth: number;
}

/** Positions pages one under another (continuous scrolling) for the given zoom. */
export function computeLayout(
  pages: readonly Size[],
  zoom: number,
  options: LayoutOptions,
): DocumentLayout {
  const slots: PageSlot[] = [];
  let top = options.padding;
  let maxWidth = 0;
  for (const page of pages) {
    const width = page.width * zoom;
    const height = page.height * zoom;
    slots.push({ top, width, height });
    top += height + options.gap;
    maxWidth = Math.max(maxWidth, width);
  }
  const lastGap = pages.length > 0 ? options.gap : 0;
  return {
    slots,
    totalHeight: top - lastGap + options.padding,
    totalWidth: maxWidth + 2 * options.padding,
  };
}

/** Index of the first page whose bottom edge is below `offset` (binary search). */
export function pageIndexAtOffset(layout: DocumentLayout, offset: number): number {
  const { slots } = layout;
  let low = 0;
  let high = slots.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const slot = slots[mid];
    if (slot !== undefined && slot.top + slot.height < offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return Math.max(0, low);
}

export interface PageRange {
  readonly first: number;
  readonly last: number;
}

/** Pages intersecting the viewport, extended by `overscan` pages on each side. */
export function visiblePageRange(
  layout: DocumentLayout,
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
): PageRange | null {
  const count = layout.slots.length;
  if (count === 0) {
    return null;
  }
  const first = pageIndexAtOffset(layout, scrollTop);
  let last = first;
  const bottom = scrollTop + viewportHeight;
  while (last + 1 < count && (layout.slots[last + 1]?.top ?? Infinity) < bottom) {
    last += 1;
  }
  return {
    first: Math.max(0, first - overscan),
    last: Math.min(count - 1, last + overscan),
  };
}

/** Fraction of the viewport, from the top, used to decide which page is "current". */
const CURRENT_PAGE_PROBE = 0.35;

/** The page shown in the status bar: the one under a line slightly above the viewport middle. */
export function currentPageIndex(
  layout: DocumentLayout,
  scrollTop: number,
  viewportHeight: number,
): number {
  return pageIndexAtOffset(layout, scrollTop + viewportHeight * CURRENT_PAGE_PROBE);
}

/** Scroll offset that places the top of `pageIndex` at the top of the viewport. */
export function scrollTopForPage(
  layout: DocumentLayout,
  pageIndex: number,
  padding: number,
): number {
  const slot = layout.slots[pageIndex];
  return slot === undefined ? 0 : Math.max(0, slot.top - padding);
}
