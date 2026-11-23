import type { FabricObject, TPointerEventInfo } from 'fabric';
import { Canvas, Point, Rect } from 'fabric';
import type {
  EditorTool,
  LayerObject,
  ObjectLayer,
  ObjectLayerCallbacks,
  ObjectLayerFactory,
} from '../../application/ports';
import type { DisplayFrame, ObjectId, ShapeObject } from '../../domain/objects';

/** Selection handles and frame in the app's accent colour. */
const SELECTION_COLOR = '#2f5fd0';
const HANDLE_SIZE = 10;
/** Extra margin (in CSS pixels) around the selected object that still counts as "over it". */
const HIT_MARGIN = HANDLE_SIZE;
const TRANSPARENT = 'transparent';
const PREVIEW_DASH_LENGTH = 6;
const PREVIEW_GAP_LENGTH = 4;
const PREVIEW_DASH = [PREVIEW_DASH_LENGTH, PREVIEW_GAP_LENGTH];

interface Drawing {
  readonly start: Point;
  readonly preview: Rect;
}

function shapeProps(shape: ShapeObject, display: DisplayFrame) {
  return {
    left: display.center.x,
    top: display.center.y,
    width: display.width,
    height: display.height,
    angle: display.angle,
    scaleX: 1,
    scaleY: 1,
    fill: shape.fill ?? TRANSPARENT,
    stroke: shape.stroke ?? TRANSPARENT,
    strokeWidth: shape.stroke === null ? 0 : shape.strokeWidth,
    opacity: shape.opacity,
  };
}

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

/** Fabric.js implementation of the editing layer over one page. */
export class FabricObjectLayer implements ObjectLayer {
  private readonly canvas: Canvas;
  private readonly items = new Map<ObjectId, FabricObject>();
  private readonly ids = new WeakMap<FabricObject, ObjectId>();
  private tool: EditorTool = 'select';
  private syncingSelection = false;
  private drawing: Drawing | null = null;

  constructor(
    host: HTMLElement,
    private readonly callbacks: ObjectLayerCallbacks,
  ) {
    const element = document.createElement('canvas');
    host.append(element);
    this.canvas = new Canvas(element, {
      selection: false,
      preserveObjectStacking: true,
      uniformScaling: false,
      enableRetinaScaling: true,
    });
    this.listen();
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
    objects.forEach(({ object, display }, index) => {
      const existing = this.items.get(object.id);
      const item = existing ?? this.createItem(object.id);
      item.set(shapeProps(object, display));
      item.setCoords();
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
    if (active === target) {
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
    this.tool = tool;
    if (tool !== 'select') {
      this.setSelection([]);
    }
    this.applyTool();
  }

  hitTest(clientX: number, clientY: number): boolean {
    const bounds = this.canvas.upperCanvasEl.getBoundingClientRect();
    const viewport = new Point(clientX - bounds.left, clientY - bounds.top);
    const zoom = this.canvas.getZoom();
    const scene = new Point(viewport.x / zoom, viewport.y / zoom);
    const active = this.canvas.getActiveObject();
    if (active !== undefined) {
      const box = active.getBoundingRect();
      const margin = HIT_MARGIN;
      const inBox =
        viewport.x >= box.left * zoom - margin &&
        viewport.x <= (box.left + box.width) * zoom + margin &&
        viewport.y >= box.top * zoom - margin &&
        viewport.y <= (box.top + box.height) * zoom + margin;
      if (inBox) {
        return true;
      }
    }
    return [...this.items.values()].some((item) => item.containsPoint(scene));
  }

  dispose(): void {
    void this.canvas.dispose();
    this.items.clear();
  }

  private createItem(id: ObjectId): FabricObject {
    const item = new Rect({
      originX: 'center',
      originY: 'center',
      strokeUniform: true,
      objectCaching: false,
      borderColor: SELECTION_COLOR,
      cornerColor: SELECTION_COLOR,
      cornerStrokeColor: '#ffffff',
      cornerSize: HANDLE_SIZE,
      cornerStyle: 'circle',
      transparentCorners: false,
      padding: 0,
    });
    this.ids.set(item, id);
    this.items.set(id, item);
    return item;
  }

  private applyTool(): void {
    const selecting = this.tool === 'select';
    for (const item of this.items.values()) {
      item.selectable = selecting;
      item.evented = selecting;
    }
    this.canvas.defaultCursor = selecting ? 'default' : 'crosshair';
    this.canvas.hoverCursor = selecting ? 'move' : 'crosshair';
  }

  private listen(): void {
    this.canvas.on('object:modified', ({ target }) => {
      const id = this.ids.get(target);
      if (id === undefined) {
        return;
      }
      const moved = target.scaleX === 1 && target.scaleY === 1;
      const frame = frameOf(target);
      // Bake scaling into width/height so the stroke and later edits stay consistent.
      target.set({ width: frame.width, height: frame.height, scaleX: 1, scaleY: 1 });
      target.setCoords();
      this.callbacks.onTransform(id, frame, moved ? 'move' : 'transform');
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
      this.startDrawing(event);
    });
    this.canvas.on('mouse:move', (event) => {
      this.updateDrawing(event);
    });
    this.canvas.on('mouse:up', (event) => {
      this.finishDrawing(event);
    });
  }

  private startDrawing({ scenePoint }: TPointerEventInfo): void {
    if (this.tool !== 'rectangle') {
      return;
    }
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
    this.drawing = { start: scenePoint, preview };
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
    this.canvas.remove(this.drawing.preview);
    this.drawing = null;
    this.callbacks.onDraw(this.tool, box, e.shiftKey);
  }
}

export const fabricObjectLayerFactory: ObjectLayerFactory = {
  create: (host, callbacks) => new FabricObjectLayer(host, callbacks),
};
