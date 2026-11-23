import { useEffect, useState } from 'react';
import { toAppError } from '../../application/errors';
import type { PageBitmap } from '../../application/ports';
import { CancelledError } from '../../application/viewer';
import type { DocumentId } from '../../domain/document';
import { logDev } from '../app/devLog';
import { useServices } from '../app/services';

export type PageBitmapState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly bitmap: PageBitmap }
  | { readonly status: 'error' };

/**
 * Requests a page bitmap at the given scale. Requests that are no longer needed (page scrolled
 * away, zoom changed) are cancelled before the engine starts on them.
 */
export function usePageBitmap(
  documentId: DocumentId,
  pageIndex: number,
  scale: number,
  priority: number,
): PageBitmapState {
  const { images } = useServices();
  const [state, setState] = useState<PageBitmapState>(() => {
    const cached = images.peek(documentId, pageIndex, scale);
    return cached === undefined ? { status: 'loading' } : { status: 'ready', bitmap: cached };
  });

  useEffect(() => {
    const task = images.request(documentId, pageIndex, scale, priority);
    let active = true;
    task.promise.then(
      (bitmap) => {
        if (active) {
          setState({ status: 'ready', bitmap });
        }
      },
      (error: unknown) => {
        if (active && !(error instanceof CancelledError)) {
          logDev(`Cannot render page ${pageIndex}`, toAppError(error));
          setState({ status: 'error' });
        }
      },
    );
    return () => {
      active = false;
      task.cancel();
    };
  }, [images, documentId, pageIndex, scale, priority]);

  return state;
}
