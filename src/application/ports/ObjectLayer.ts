import type { FontFamilyId, FontFamilyInfo } from '../../domain/fonts';
import type { DisplayFrame, EditObject, ObjectId, TextStyle } from '../../domain/objects';
import type { Point } from '../../domain/geometry';

export type DrawingTool = 'rectangle' | 'whiteout';
export type EditorTool = 'select' | 'text' | 'eyedropper' | DrawingTool;

/** An object prepared for the editing layer: its frame is already in display space. */
export interface LayerObject {
  readonly object: EditObject;
  readonly display: DisplayFrame;
}

export interface ObjectLayerCallbacks {
  /** The user selected objects (or clicked away: empty list). */
  readonly onSelect: (ids: readonly ObjectId[]) => void;
  /** The user finished moving, resizing or rotating an object. Frame in display space. */
  readonly onTransform: (id: ObjectId, display: DisplayFrame, kind: 'move' | 'transform') => void;
  /** The user drew a new rectangle-like object. Frame in display space. */
  readonly onDraw: (tool: DrawingTool, display: DisplayFrame) => void;
  /** The user typed a new text box with the text tool (not called when nothing was typed). */
  readonly onTextCreated: (display: DisplayFrame, text: string) => void;
  /** The user finished editing an existing text box. */
  readonly onTextEdited: (id: ObjectId, text: string, display: DisplayFrame) => void;
  /** The user clicked with the eyedropper; point in display space. */
  readonly onPick: (point: Point) => void;
}

/** What the layer needs to know about fonts to show text. */
export interface LayerFonts {
  cssFamily(id: FontFamilyId): string;
  family(id: FontFamilyId): FontFamilyInfo | undefined;
}

/**
 * Interactive layer over one rendered page: shows the objects with selection handles and turns
 * mouse/pen gestures into callbacks. Implemented with Fabric.js; the rest of the app only sees
 * this interface, so the library can be replaced.
 */
export interface ObjectLayer {
  /** Page size in display points and the current zoom. */
  setSize(width: number, height: number, zoom: number): void;
  setObjects(objects: readonly LayerObject[]): void;
  setSelection(ids: readonly ObjectId[]): void;
  setTool(tool: EditorTool): void;
  /** Style and width of text boxes created with the text tool. */
  setTextDefaults(style: TextStyle, width: number): void;
  /** True when the pointer (client coordinates) is over an object or a selection handle. */
  hitTest(clientX: number, clientY: number): boolean;
  dispose(): void;
}

export interface ObjectLayerFactory {
  create(host: HTMLElement, callbacks: ObjectLayerCallbacks, fonts: LayerFonts): ObjectLayer;
}
