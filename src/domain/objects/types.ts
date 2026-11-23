import type { Point } from '../geometry';

export type ObjectId = string;

/** Colour as "#rrggbb". */
export type HexColor = string;

/**
 * Position, size and rotation of an object, stored in PDF space (points, Y axis up), so that
 * objects stay attached to the page content when the page is rotated later.
 * `width` and `height` are measured along the object's own axes; `angle` is counter-clockwise,
 * in degrees, relative to the PDF space axes.
 */
export interface ObjectFrame {
  readonly center: Point;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
}

interface EditObjectBase {
  readonly id: ObjectId;
  readonly pageIndex: number;
  readonly frame: ObjectFrame;
  /** 0 (invisible) … 1 (opaque). */
  readonly opacity: number;
}

export type ShapeKind = 'rectangle';

export interface ShapeObject extends EditObjectBase {
  readonly kind: 'shape';
  readonly shape: ShapeKind;
  readonly stroke: HexColor | null;
  readonly fill: HexColor | null;
  /** Line width in points. */
  readonly strokeWidth: number;
}

/**
 * Everything the user added on top of the original document. Text, drawings, images,
 * annotations, whiteout and redaction marks join this union in later stages.
 */
export type EditObject = ShapeObject;

export type EditObjectKind = EditObject['kind'];
