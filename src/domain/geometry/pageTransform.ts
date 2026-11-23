import { compose, invert, scale, translate } from './matrix';
import type { Matrix, PageRotation, Rect, Size } from './types';
import { FULL_TURN_DEGREES, QUARTER_TURN_DEGREES } from './types';

/**
 * Coordinate spaces:
 * - PDF space: page user space in points, origin at the bottom-left of the PDF, Y axis up.
 * - Display space: the page as the reader sees it (rotation applied), in points,
 *   origin at the top-left of the visible (crop) box, Y axis down.
 * - View space: display space multiplied by zoom, in CSS pixels.
 */

export function normalizeRotation(degrees: number): PageRotation {
  const turns = Math.round(degrees / QUARTER_TURN_DEGREES);
  const normalized =
    (((turns * QUARTER_TURN_DEGREES) % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
  return normalized as PageRotation;
}

/** Size of the page as displayed (width and height swap for 90° and 270°). */
export function displaySize(cropBox: Size, rotation: PageRotation): Size {
  const swapped = rotation === 90 || rotation === 270;
  return swapped
    ? { width: cropBox.height, height: cropBox.width }
    : { width: cropBox.width, height: cropBox.height };
}

/** Clockwise rotation in a Y-down space of size `size`, keeping the result in positive coordinates. */
function rotationInYDownSpace(rotation: PageRotation, size: Size): Matrix {
  const { width, height } = size;
  switch (rotation) {
    case 0:
      return [1, 0, 0, 1, 0, 0];
    case 90:
      // (x, y) → (height − y, x)
      return [0, 1, -1, 0, height, 0];
    case 180:
      // (x, y) → (width − x, height − y)
      return [-1, 0, 0, -1, width, height];
    case 270:
      // (x, y) → (y, width − x)
      return [0, -1, 1, 0, 0, width];
  }
}

/** Matrix from PDF space to display space (zoom 1). */
export function pdfToDisplayMatrix(cropBox: Rect, rotation: PageRotation): Matrix {
  const toOrigin = translate(-cropBox.x, -cropBox.y);
  const flipY: Matrix = [1, 0, 0, -1, 0, cropBox.height];
  return compose(toOrigin, flipY, rotationInYDownSpace(rotation, cropBox));
}

/** Matrix from PDF space to view space (CSS pixels at the given zoom). */
export function pdfToViewMatrix(cropBox: Rect, rotation: PageRotation, zoom: number): Matrix {
  return compose(pdfToDisplayMatrix(cropBox, rotation), scale(zoom));
}

/** Matrix from view space (CSS pixels at the given zoom) back to PDF space. */
export function viewToPdfMatrix(cropBox: Rect, rotation: PageRotation, zoom: number): Matrix {
  return invert(pdfToViewMatrix(cropBox, rotation, zoom));
}
