import type { PageInfo } from '../document';
import type { Point } from '../geometry';
import { applyToPoint, invert, pdfToDisplayMatrix } from '../geometry';
import type { ObjectFrame } from './types';

const HALF_TURN = 180;
const FULL_TURN = 360;

/** Frame as the reader sees it: display space (points, Y down), clockwise angle in degrees. */
export interface DisplayFrame {
  readonly center: Point;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
}

/** Normalizes an angle to the range (−180°, 180°]. */
export function normalizeAngle(degrees: number): number {
  const wrapped = ((((degrees + HALF_TURN) % FULL_TURN) + FULL_TURN) % FULL_TURN) - HALF_TURN;
  return wrapped === -HALF_TURN ? HALF_TURN : wrapped;
}

/**
 * PDF space has the Y axis up and counter-clockwise angles; display space has Y down,
 * clockwise angles and the page rotation applied. A direction at angle θ (CCW, PDF) is seen
 * at R − θ (CW, display), where R is the page rotation.
 */
export function frameToDisplay(frame: ObjectFrame, page: PageInfo): DisplayFrame {
  return {
    center: applyToPoint(pdfToDisplayMatrix(page.cropBox, page.rotation), frame.center),
    width: frame.width,
    height: frame.height,
    angle: normalizeAngle(page.rotation - frame.angle),
  };
}

export function displayToFrame(display: DisplayFrame, page: PageInfo): ObjectFrame {
  return {
    center: applyToPoint(invert(pdfToDisplayMatrix(page.cropBox, page.rotation)), display.center),
    width: display.width,
    height: display.height,
    angle: normalizeAngle(page.rotation - display.angle),
  };
}

/** Same frame in view space (CSS pixels) at the given zoom. */
export function displayToView(display: DisplayFrame, zoom: number): DisplayFrame {
  return {
    center: { x: display.center.x * zoom, y: display.center.y * zoom },
    width: display.width * zoom,
    height: display.height * zoom,
    angle: display.angle,
  };
}

export function viewToDisplay(view: DisplayFrame, zoom: number): DisplayFrame {
  return displayToView(view, 1 / zoom);
}

/** Moves a frame by (dx, dy) in display space, e.g. when the user presses an arrow key. */
export function moveFrameOnScreen(
  frame: ObjectFrame,
  page: PageInfo,
  dx: number,
  dy: number,
): ObjectFrame {
  const display = frameToDisplay(frame, page);
  return displayToFrame(
    { ...display, center: { x: display.center.x + dx, y: display.center.y + dy } },
    page,
  );
}
