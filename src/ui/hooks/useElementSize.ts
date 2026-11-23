import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

export interface ElementSize {
  readonly width: number;
  readonly height: number;
}

/** Tracks the content size of an element with ResizeObserver. */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        const { width, height } = entry.contentRect;
        setSize((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        );
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}
