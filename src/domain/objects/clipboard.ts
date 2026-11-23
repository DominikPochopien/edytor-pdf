import type { PageInfo } from '../document';
import { moveFrameOnScreen } from './frame';
import type { EditObject, ObjectId } from './types';

/** Pasted copies on the same page are shifted so they do not hide the original. */
export const PASTE_OFFSET = 12;

/**
 * Creates copies of objects for pasting on `target` page. Copies keep their position on the
 * screen; when pasted on the page they came from, they are shifted by PASTE_OFFSET points.
 */
export function copiesForPaste(
  objects: readonly EditObject[],
  target: PageInfo,
  newId: () => ObjectId,
): EditObject[] {
  return objects.map((object) => {
    const samePage = object.pageIndex === target.index;
    const frame = samePage
      ? moveFrameOnScreen(object.frame, target, PASTE_OFFSET, PASTE_OFFSET)
      : object.frame;
    return { ...object, id: newId(), pageIndex: target.index, frame };
  });
}
