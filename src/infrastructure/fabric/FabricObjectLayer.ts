import type { FabricObject, TPointerEventInfo } from 'fabric';
import { Canvas, cache, Point, Rect, Textbox } from 'fabric';
import type {
  DrawingTool,
  EditorTool,
  LayerFonts,
  LayerObject,
  ObjectLayer,
  ObjectLayerCallbacks,
  ObjectLayerFactory,
} from '../../application/ports';
import type { DisplayFrame, ObjectId, TextStyle } from '../../domain/objects';
import { DEFAULT_TEXT_STYLE, DEFAULT_TEXT_WIDTH } from '../../application/use-cases';
import { textboxOptions } from './textboxOptions';

/** Selection handles and frame in the app's accent colour. */
const SELECTION_COLOR = '#2f5fd0';
const HANDLE_SIZE = 10;
/** Extra margin (in CSS pixels) around the selected object that still counts as "over it". */
const HIT_MARGIN = HANDLE_SIZE;
const TRANSPARENT = 'transparent';
const PREVIEW_DASH_LENGTH = 6;
const PREVIEW_GAP_LENGTH = 4;
const PREVIEW_DASH = [PREVIEW_DASH_LENGTH, PREVIEW_GAP_LENGTH];
const TEXT_SELECTION_COLOR = 'rgba(47, 95, 208, 0.25)';

/** Text boxes are resized by width only (left/right handles); the font size is set in the panel. */
const TEXT_CONTROLS = { tl: false, tr: false, bl: false, br: false, mt: false, mb: false } as const;

const DRAWING_TOOLS: readonly EditorTool[] = ['rectangle', 'whiteout'];

interface Drawing {
  readonly tool: DrawingTool;
  readonly start: Point;
  readonly preview: Rect;
}

const COMMON_ITEM_OPTIONS = {
  originX: 'center',
  originY: 'center',
  objectCaching: false,
  borderColor: SELECTION_COLOR,
  cornerColor: SELECTION_COLOR,
  cornerStrokeColor: '#ffffff',
  cornerSize: HANDLE_SIZE,
  cornerStyle: 'circle',
  transparentCorners: false,
  padding: 0,
} as const;

/** Frame of a Fabric object in display space (Fabric scene units are display points). */
function frameOf(target: FabricObject): DisplayFrame {
  const center = target.getCenterPoint();
  return {
    center: { x: center.x, y: center.y },
    width: Math.abs(target.width * target.scaleX),
    height: Math.abs(target.height * target.scaleY),
    angle: target.angle,
  };
}

function isDrawingTool(tool: EditorTool): tool is DrawingTool {
  return DRAWING_TOOLS.includes(tool);
}

/** Fabric.js implementation of the editing layer over one page. */
export class FabricObjectLayer implements ObjectLayer {
  private readonly element: HTMLCanvasElement;
  private readonly canvas: Canvas;
  private readonly items = new Map<ObjectId, FabricObject>();
  private readonly ids = new WeakMap<FabricObject, ObjectId>();
  private readonly measuredFamilies = new Set<string>();
  private tool: EditorTool = 'select';
  private syncingSelection = false;
  private drawing: Drawing | null = null;
  /** A text box being typed with the text tool; it becomes an object when editing ends. */
  private pendingText: Textbox | null = null;
  private textDefaults: { style: TextStyle; width: number } = {
    style: DEFAULT_TEXT_STYLE,
    width: DEFAULT_TEXT_WIDTH,
  };
  private readonly onDocumentPointerDown = (event: PointerEvent): void => {
    if (event.target !== this.canvas.upperCanvasEl) {
      this.finishTextEditing();
    }
  };

  constructor(
    host: HTMLElement,
    private readonly callbacks: ObjectLayerCallbacks,
    private readonly fonts: LayerFonts,
  ) {
    this.element = document.createElement('canvas');
    host.append(this.element);
    this.canvas = new Canvas(this.element, {
      selection: false,
      preserveObjectStacking: true,
      uniformScaling: false,
      enableRetinaScaling: true,
    });
    this.listen();
    document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
  }

  setSize(width: number, height: number, zoom: number): void {
    this.canvas.setDimensions({ width: width * zoom, height: height * zoom });
    this.canvas.setZoom(zoom);
    this.canvas.requestRenderAll();
  }

  setObjects(objects: readonly LayerObject[]): void {
    const wanted = new Set(objects.map(({ object }) => object.id));
    for (const [id, item] of this.items) {
      if (!wanted.has(id)) {
        this.canvas.remove(item);
        this.items.delete(id);
      }
    }
    objects.forEach((layerObject, index) => {
      const { id } = layerObject.object;
      const existing = this.items.get(id);
      const item = existing ?? this.createItem(layerObject);
      this.update(item, layerObject);
      if (existing === undefined) {
        this.canvas.add(item);
      }
      this.canvas.moveObjectTo(item, index);
    });
    this.applyTool();
    this.canvas.requestRenderAll();
  }

  setSelection(ids: readonly ObjectId[]): void {
    const target = ids.length === 0 ? undefined : this.items.get(ids[0] ?? '');
    const active = this.canvas.getActiveObject();
    if (
      active === target ||
      (target === undefined && this.pendingText !== null && active === this.pendingText)
    ) {
      return;
    }
    this.syncingSelection = true;
    try {
      if (target === undefined) {
        this.canvas.discardActiveObject();
      } else {
        this.canvas.setActiveObject(target);
      }
    } finally {
      this.syncingSelection = false;
    }
    this.canvas.requestRenderAll();
  }

  setTool(tool: EditorTool): void {
    if (tool !== this.tool) {
      this.finishTextEditing();
    }
    this.tool = tool;
    if (tool !== 'select' && tool !== 'text') {
      this.setSelection([]);
    }
    this.applyTool();
  }

  setTextDefaults(style: TextStyle, width: number): void {
    this.textDefaults = { style, width };
  }

  hitTest(clientX: number, clientY: number): boolean {
    if (this.isEditingText()) {
      return true;
    }
    const bounds = this.canvas.upperCanvasEl.getBoundingClientRect();
    const viewport = new Point(clientX - bounds.left, clientY - bounds.top);
    const zoom = this.canvas.getZoom();
    const scene = new Point(viewport.x / zoom, viewport.y / zoom);
    const active = this.canvas.getActiveObject();
    if (active !== undefined) {
      const box = active.getBoundingRect();
      const inBox =
        viewport.x >= box.left * zoom - HIT_MARGIN &&
        viewport.x <= (box.left + box.width) * zoom + HIT_MARGIN &&
        viewport.y >= box.top * zoom - HIT_MARGIN &&
        viewport.y <= (box.top + box.height) * zoom + HIT_MARGIN;
      if (inBox) {
        return true;
      }
    }
    return [...this.items.values()].some((item) => item.containsPoint(scene));
  }

  dispose(): void {
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.items.clear();
    void this.canvas.dispose().then(() => {
      this.element.remove();
    });
  }

  private createItem({ object }: LayerObject): FabricObject {
    const item =
      object.kind === 'text'
        ? new Textbox(object.text, {
            ...COMMON_ITEM_OPTIONS,
            lockScalingY: true,
            lockScalingFlip: true,
            editable: true,
            selectionColor: TEXT_SELECTION_COLOR,
            cursorColor: SELECTION_COLOR,
          })
        : new Rect({ ...COMMON_ITEM_OPTIONS, strokeUniform: true });
    if (item instanceof Textbox) {
      item.setControlsVisibility(TEXT_CONTROLS);
    }
    this.ids.set(item, object.id);
    this.items.set(object.id, item);
    return item;
  }

  private update(item: FabricObject, { object, display }: LayerObject): void {
    const position = {
      left: display.center.x,
      top: display.center.y,
      angle: display.angle,
      scaleX: 1,
      scaleY: 1,
      opacity: object.opacity,
    };
    switch (object.kind) {
      case 'shape':
        item.set({
          ...position,
          width: display.width,
          height: display.height,
          fill: object.fill ?? TRANSPARENT,
          stroke: object.stroke ?? TRANSPARENT,
          strokeWidth: object.stroke === null ? 0 : object.strokeWidth,
        });
        break;
      case 'whiteout':
        item.set({
          ...position,
          width: display.width,
          height: display.height,
          fill: object.color,
          stroke: TRANSPARENT,
          strokeWidth: 0,
        });
        break;
      case 'text':
        if (item instanceof Textbox) {
          const options = textboxOptions(object.style, display.width, this.fonts);
          this.forgetFallbackMeasurements(options.fontFamily);
          if (!item.isEditing) {
            item.set({ text: object.text });
          }
          item.set({ ...options, ...position });
          item.initDimensions();
        }
        break;
    }
    item.setCoords();
  }

  /** Fabric caches glyph widths per family; drop anything measured before the font was loaded. */
  private forgetFallbackMeasurements(fontFamily: string): void {
    if (!this.measuredFamilies.has(fontFamily)) {
      this.measuredFamilies.add(fontFamily);
      cache.clearFontCache(fontFamily);
    }
  }

  private applyTool(): void {
    const selecting = this.tool === 'select';
    for (const item of this.items.values()) {
      const interactive = selecting || (this.tool === 'text' && item instanceof Textbox);
      item.selectable = interactive;
      item.evented = interactive;
    }
    const cursor = selecting ? 'default' : this.tool === 'text' ? 'text' : 'crosshair';
    this.canvas.defaultCursor = cursor;
    this.canvas.hoverCursor = selecting ? 'move' : cursor;
  }

  private isEditingText(): boolean {
    if (this.pendingText !== null) {
      return true;
    }
    return [...this.items.values()].some((item) => item instanceof Textbox && item.isEditing);
  }

  private finishTextEditing(): void {
    if (this.pendingText?.isEditing === true) {
      this.pendingText.exitEditing();
    }
    for (const item of this.items.values()) {
      if (item instanceof Textbox && item.isEditing) {
        item.exitEditing();
      }
    }
  }

  private listen(): void {
    this.canvas.on('object:modified', ({ target, action }) => {
      const id = this.ids.get(target);
      // Fabric also reports the end of text editing as "modified"; that is handled separately.
      if (id === undefined || (target instanceof Textbox && action === undefined)) {
        return;
      }
      const moved = action === 'drag';
      const frame = frameOf(target);
      // Bake scaling into width/height so the stroke and later edits stay consistent.
      target.set({ width: frame.width, height: frame.height, scaleX: 1, scaleY: 1 });
      target.setCoords();
      this.callbacks.onTransform(id, frame, moved ? 'move' : 'transform');
    });
    this.canvas.on('text:editing:exited', ({ target }) => {
      this.onEditingExited(target);
    });
    const onSelection = (): void => {
      if (this.syncingSelection) {
        return;
      }
      const active = this.canvas.getActiveObject();
      const id = active === undefined ? undefined : this.ids.get(active);
      this.callbacks.onSelect(id === undefined ? [] : [id]);
    };
    this.canvas.on('selection:created', onSelection);
    this.canvas.on('selection:updated', onSelection);
    this.canvas.on('selection:cleared', onSelection);

    this.canvas.on('mouse:down', (event) => {
      this.onPointerDown(event);
    });
    this.canvas.on('mouse:move', (event) => {
      this.updateDrawing(event);
    });
    this.canvas.on('mouse:up', (event) => {
      this.finishDrawing(event);
    });
  }

  private onEditingExited(target: FabricObject): void {
    if (!(target instanceof Textbox)) {
      return;
    }
    const frame = frameOf(target);
    if (target === this.pendingText) {
      this.pendingText = null;
      // Fabric still uses the box right after this event, so remove it a moment later.
      setTimeout(() => {
        this.canvas.remove(target);
        this.canvas.requestRenderAll();
      }, 0);
      if (target.text.trim() !== '') {
        this.callbacks.onTextCreated(frame, target.text);
      }
      return;
    }
    const id = this.ids.get(target);
    if (id !== undefined) {
      this.callbacks.onTextEdited(id, target.text, frame);
    }
  }

  private onPointerDown(event: TPointerEventInfo): void {
    const { scenePoint, target } = event;
    if (this.tool === 'eyedropper') {
      this.callbacks.onPick({ x: scenePoint.x, y: scenePoint.y });
      return;
    }
    if (this.tool === 'text') {
      if (target instanceof Textbox && target !== this.pendingText) {
        this.canvas.setActiveObject(target);
        target.enterEditing();
        return;
      }
      if (this.pendingText === null) {
        this.startText(scenePoint);
      }
      return;
    }
    if (isDrawingTool(this.tool)) {
      this.startDrawing(this.tool, scenePoint);
    }
  }

  private startText(point: Point): void {
    const { style, width } = this.textDefaults;
    const options = textboxOptions(style, width, this.fonts);
    this.forgetFallbackMeasurements(options.fontFamily);
    const box = new Textbox('', {
      ...COMMON_ITEM_OPTIONS,
      ...options,
      editable: true,
      selectionColor: TEXT_SELECTION_COLOR,
      cursorColor: SELECTION_COLOR,
    });
    box.setControlsVisibility(TEXT_CONTROLS);
    // The click marks the top-left corner of the new text box.
    box.set({ left: point.x + width / 2, top: point.y + box.height / 2 });
    this.pendingText = box;
    this.canvas.add(box);
    this.canvas.setActiveObject(box);
    box.enterEditing();
    this.canvas.requestRenderAll();
  }

  private startDrawing(tool: DrawingTool, scenePoint: Point): void {
    const preview = new Rect({
      originX: 'left',
      originY: 'top',
      left: scenePoint.x,
      top: scenePoint.y,
      width: 0,
      height: 0,
      fill: TRANSPARENT,
      stroke: SELECTION_COLOR,
      strokeWidth: 1,
      strokeUniform: true,
      strokeDashArray: PREVIEW_DASH,
      selectable: false,
      evented: false,
    });
    this.canvas.add(preview);
    this.drawing = { tool, start: scenePoint, preview };
  }

  private drawnBox(scenePoint: Point, constrained: boolean): DisplayFrame | null {
    if (this.drawing === null) {
      return null;
    }
    const { start } = this.drawing;
    let dx = scenePoint.x - start.x;
    let dy = scenePoint.y - start.y;
    if (constrained) {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * side;
      dy = Math.sign(dy || 1) * side;
    }
    return {
      center: { x: start.x + dx / 2, y: start.y + dy / 2 },
      width: Math.abs(dx),
      height: Math.abs(dy),
      angle: 0,
    };
  }

  private updateDrawing({ scenePoint, e }: TPointerEventInfo): void {
    const box = this.drawnBox(scenePoint, e.shiftKey);
    if (box === null || this.drawing === null) {
      return;
    }
    this.drawing.preview.set({
      left: box.center.x - box.width / 2,
      top: box.center.y - box.height / 2,
      width: box.width,
      height: box.height,
    });
    this.canvas.requestRenderAll();
  }

  private finishDrawing({ scenePoint, e }: TPointerEventInfo): void {
    const box = this.drawnBox(scenePoint, e.shiftKey);
    if (box === null || this.drawing === null) {
      return;
    }
    const { tool, preview } = this.drawing;
    this.canvas.remove(preview);
    this.drawing = null;
    this.callbacks.onDraw(tool, box);
  }
}

export const fabricObjectLayerFactory: ObjectLayerFactory = {
  create: (host, callbacks, fonts) => new FabricObjectLayer(host, callbacks, fonts),
};

export { FabricTextLayout } from './FabricTextLayout';
