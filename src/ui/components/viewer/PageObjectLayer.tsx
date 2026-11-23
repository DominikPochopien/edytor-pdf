import { useEffect, useMemo, useRef, useState } from 'react';
import type { ObjectLayer, ObjectLayerCallbacks } from '../../../application/ports';
import { textFontKey } from '../../../application/use-cases';
import type { PageInfo } from '../../../domain/document';
import type { Point } from '../../../domain/geometry';
import { displaySize } from '../../../domain/geometry';
import type { HexColor } from '../../../domain/objects';
import { frameToDisplay, objectsOnPage } from '../../../domain/objects';
import { logDev } from '../../app/devLog';
import { useServices } from '../../app/services';
import { useEditorActions } from '../../hooks/useEditorActions';
import { useEditorStore } from '../../store/editorStore';

interface PageObjectLayerProps {
  readonly page: PageInfo;
  readonly zoom: number;
}

const HEX_RADIX = 16;
const HEX_DIGITS = 2;

/** Colour of the rendered page (without added objects) under a point in display space. */
function samplePageColor(pageElement: HTMLElement, point: Point, width: number): HexColor | null {
  const canvas = pageElement.querySelector<HTMLCanvasElement>('canvas[data-page-canvas]');
  const context = canvas?.getContext('2d', { willReadFrequently: true });
  if (canvas === null || context === null || context === undefined) {
    return null;
  }
  const scale = canvas.width / width;
  const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(point.x * scale)));
  const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(point.y * scale)));
  const [r = 0, g = 0, b = 0] = context.getImageData(x, y, 1, 1).data;
  return `#${[r, g, b].map((c) => c.toString(HEX_RADIX).padStart(HEX_DIGITS, '0')).join('')}`;
}

/**
 * The editing layer of one page. It only catches the mouse when the pointer is over an object
 * (or a tool is active); elsewhere the text below stays selectable.
 */
export function PageObjectLayer({ page, zoom }: PageObjectLayerProps) {
  const { loadObjectLayers, fonts } = useServices();
  const actions = useEditorActions();
  const hostRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<ObjectLayer | null>(null);
  const allObjects = useEditorStore((s) => s.snapshot.model.objects);
  const selection = useEditorStore((s) => s.selection);
  const tool = useEditorStore((s) => s.tool);
  const textDefaults = useEditorStore((s) => s.textDefaults);
  const size = useMemo(() => displaySize(page.cropBox, page.rotation), [page]);
  const layerObjects = useMemo(
    () =>
      objectsOnPage({ objects: allObjects }, page.index).map((object) => ({
        object,
        display: frameToDisplay(object.frame, page),
      })),
    [allObjects, page],
  );

  // Callbacks read the latest actions through a ref, so the layer is created only once.
  const callbacksRef = useRef<ObjectLayerCallbacks | null>(null);
  useEffect(() => {
    callbacksRef.current = {
      onSelect: (ids) => {
        actions.select(ids);
      },
      onTransform: (id, display, kind) => {
        actions.transform(id, display, kind);
      },
      onDraw: (drawTool, display) => {
        actions.draw(drawTool, page.index, display);
      },
      onTextCreated: (display, text) => {
        actions.addText(page.index, display, text);
      },
      onTextEdited: (id, text, display) => {
        actions.finishTextEdit(id, text, display);
      },
      onPick: (point) => {
        const pageElement = hostRef.current?.parentElement;
        const color =
          pageElement === null || pageElement === undefined
            ? null
            : samplePageColor(pageElement, point, size.width);
        if (color !== null) {
          actions.pickColor(color);
        }
      },
    };
  }, [actions, page.index, size.width]);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    let created: ObjectLayer | null = null;
    let cancelled = false;
    loadObjectLayers().then(
      (factory) => {
        if (cancelled) {
          return;
        }
        created = factory.create(
          host,
          {
            onSelect: (ids) => callbacksRef.current?.onSelect(ids),
            onTransform: (id, display, kind) =>
              callbacksRef.current?.onTransform(id, display, kind),
            onDraw: (drawTool, display) => callbacksRef.current?.onDraw(drawTool, display),
            onTextCreated: (display, text) => callbacksRef.current?.onTextCreated(display, text),
            onTextEdited: (id, text, display) =>
              callbacksRef.current?.onTextEdited(id, text, display),
            onPick: (point) => callbacksRef.current?.onPick(point),
          },
          fonts,
        );
        setLayer(created);
      },
      (error: unknown) => {
        logDev('Cannot load the editing layer', error);
      },
    );
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [loadObjectLayers, fonts]);

  useEffect(() => {
    layer?.setSize(size.width, size.height, zoom);
  }, [layer, size, zoom]);

  // Text is shown only once its font is loaded, otherwise it would be measured with another font.
  useEffect(() => {
    if (layer === null) {
      return undefined;
    }
    let current = true;
    const keys = layerObjects.flatMap(({ object }) =>
      object.kind === 'text' ? [textFontKey(object.style, fonts)] : [],
    );
    fonts.ensureLoaded([...new Set(keys)]).then(
      () => {
        if (current) {
          layer.setObjects(layerObjects);
        }
      },
      (error: unknown) => {
        logDev('Cannot load fonts', error);
        if (current) {
          layer.setObjects(layerObjects);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [layer, layerObjects, fonts]);

  useEffect(() => {
    const onThisPage = new Set(layerObjects.map(({ object }) => object.id));
    layer?.setSelection(selection.filter((id) => onThisPage.has(id)));
  }, [layer, selection, layerObjects]);

  useEffect(() => {
    layer?.setTool(tool);
  }, [layer, tool]);

  useEffect(() => {
    layer?.setTextDefaults(textDefaults.style, textDefaults.width);
  }, [layer, textDefaults]);

  // Let the mouse through to the text layer unless it is over an object or a tool is active.
  useEffect(() => {
    const host = hostRef.current;
    const pageElement = host?.parentElement;
    if (host === null || pageElement === null || pageElement === undefined || layer === null) {
      return undefined;
    }
    const update = (event: PointerEvent): void => {
      if (event.buttons !== 0) {
        return;
      }
      const active = tool !== 'select' || layer.hitTest(event.clientX, event.clientY);
      host.style.pointerEvents = active ? 'auto' : 'none';
    };
    const deselect = (event: PointerEvent): void => {
      if (host.style.pointerEvents === 'none' && !host.contains(event.target as Node)) {
        const { selection: selected } = useEditorStore.getState();
        if (selected.some((id) => layerObjects.some(({ object }) => object.id === id))) {
          actions.select([]);
        }
      }
    };
    host.style.pointerEvents = tool === 'select' ? 'none' : 'auto';
    pageElement.addEventListener('pointermove', update);
    pageElement.addEventListener('pointerdown', deselect);
    return () => {
      pageElement.removeEventListener('pointermove', update);
      pageElement.removeEventListener('pointerdown', deselect);
    };
  }, [layer, tool, layerObjects, actions]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0"
      data-testid={`object-layer-${page.index}`}
      data-tool={tool}
    />
  );
}
