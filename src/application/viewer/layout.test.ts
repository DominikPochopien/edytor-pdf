import { describe, expect, it } from 'vitest';
import {
  computeLayout,
  currentPageIndex,
  pageIndexAtOffset,
  scrollTopForPage,
  visiblePageRange,
} from './layout';

const page = { width: 100, height: 200 };
const options = { gap: 10, padding: 20 };

describe('computeLayout', () => {
  it('stacks pages vertically with gaps and padding', () => {
    const layout = computeLayout([page, page, page], 1, options);
    expect(layout.slots.map((s) => s.top)).toEqual([20, 230, 440]);
    expect(layout.totalHeight).toBe(20 + 3 * 200 + 2 * 10 + 20);
    expect(layout.totalWidth).toBe(140);
  });

  it('applies zoom to page sizes', () => {
    const layout = computeLayout([page], 2, options);
    expect(layout.slots[0]).toEqual({ top: 20, width: 200, height: 400 });
  });

  it('handles an empty document', () => {
    const layout = computeLayout([], 1, options);
    expect(layout.slots).toEqual([]);
    expect(layout.totalHeight).toBe(40);
  });
});

describe('visible pages', () => {
  const layout = computeLayout(
    Array.from({ length: 300 }, () => page),
    1,
    options,
  );

  it('finds the page at an offset', () => {
    expect(pageIndexAtOffset(layout, 0)).toBe(0);
    expect(pageIndexAtOffset(layout, 225)).toBe(1);
    expect(pageIndexAtOffset(layout, 1e9)).toBe(299);
  });

  it('returns only pages in the viewport plus overscan', () => {
    expect(visiblePageRange(layout, 210 * 100, 500, 1)).toEqual({ first: 98, last: 103 });
    expect(visiblePageRange(layout, 0, 500, 2)).toEqual({ first: 0, last: 4 });
  });

  it('returns null for an empty document', () => {
    expect(visiblePageRange(computeLayout([], 1, options), 0, 500, 1)).toBeNull();
  });

  it('reports the current page and the scroll position of a page', () => {
    expect(currentPageIndex(layout, 0, 800)).toBe(1);
    expect(scrollTopForPage(layout, 10, 20)).toBe(210 * 10);
    expect(scrollTopForPage(layout, 999, 20)).toBe(0);
  });
});
