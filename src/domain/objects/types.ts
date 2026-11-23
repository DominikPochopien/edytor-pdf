import type { FontFamilyId } from '../fonts';
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

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface TextStyle {
  readonly fontFamily: FontFamilyId;
  /** Font size in points. */
  readonly fontSize: number;
  readonly color: HexColor;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly align: TextAlign;
  /** Distance between baselines as a multiple of the font size. */
  readonly lineHeight: number;
}

/**
 * A text box. `frame.width` is the wrapping width; `frame.height` follows from the text
 * (it is recalculated whenever the text, width or style changes).
 */
export interface TextObject extends EditObjectBase {
  readonly kind: 'text';
  readonly text: string;
  readonly style: TextStyle;
}

/** A filled rectangle that covers content. It does not remove anything from the file. */
export interface WhiteoutRect extends EditObjectBase {
  readonly kind: 'whiteout';
  readonly color: HexColor;
}

/**
 * Everything the user added on top of the original document. Drawings, images,
 * annotations and redaction marks join this union in later stages.
 */
export type EditObject = ShapeObject | TextObject | WhiteoutRect;

export type EditObjectKind = EditObject['kind'];
