/** A point. Units depend on the coordinate space (see docs/PLAN.md, "Konwencje"). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Axis-aligned rectangle given by its top-left (or bottom-left in PDF space) corner and size. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Affine matrix [a, b, c, d, e, f] in PDF convention: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = readonly [number, number, number, number, number, number];

/** Page rotation allowed by the PDF /Rotate key, clockwise. */
export type PageRotation = 0 | 90 | 180 | 270;

export const FULL_TURN_DEGREES = 360;
export const QUARTER_TURN_DEGREES = 90;
