import type { DisplayFrame, EditObject, ObjectId } from '../../domain/objects';

export type EditorTool = 'select' | 'rectangle';

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
  /** The user drew a new shape with a drawing tool. Frame in display space. */
  readonly onDraw: (tool: EditorTool, display: DisplayFrame, constrained: boolean) => void;
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
  /** True when the pointer (client coordinates) is over an object or a selection handle. */
  hitTest(clientX: number, clientY: number): boolean;
  dispose(): void;
}

export interface ObjectLayerFactory {
  create(host: HTMLElement, callbacks: ObjectLayerCallbacks): ObjectLayer;
}
