/** Index of the next search hit, wrapping around at the end. */
export function nextHitIndex(current: number | null, count: number): number | null {
  if (count === 0) {
    return null;
  }
  return current === null ? 0 : (current + 1) % count;
}

/** Index of the previous search hit, wrapping around at the start. */
export function previousHitIndex(current: number | null, count: number): number | null {
  if (count === 0) {
    return null;
  }
  return current === null ? count - 1 : (current - 1 + count) % count;
}

/** First hit on or after the given page, so a new search starts near where the user is. */
export function firstHitFromPage(hitPages: readonly number[], pageIndex: number): number | null {
  if (hitPages.length === 0) {
    return null;
  }
  const index = hitPages.findIndex((page) => page >= pageIndex);
  return index === -1 ? 0 : index;
}
