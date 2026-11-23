import { useEffect, useMemo, useRef, useState } from 'react';
import type { ObjectLayer, ObjectLayerCallbacks } from '../../../application/ports';
import type { PageInfo } from '../../../domain/document';
import { frameToDisplay, objectsOnPage } from '../../../domain/objects';
import { displaySize } from '../../../domain/geometry';
import { logDev } from '../../app/devLog';
import { useServices } from '../../app/services';
import { useEditorActions } from '../../hooks/useEditorActions';
import { useEditorStore } from '../../store/editorStore';

interface PageObjectLayerProps {
  readonly page: PageInfo;
  readonly zoom: number;
}

/**
 * The editing layer of one page. It only catches the mouse when the pointer is over an object
 * (or a drawing tool is active); elsewhere the text below stays selectable.
 */
export function PageObjectLayer({ page, zoom }: PageObjectLayerProps) {
  const { loadObjectLayers } = useServices();
  const actions = useEditorActions();
  const hostRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<ObjectLayer | null>(null);
  const allObjects = useEditorStore((s) => s.snapshot.model.objects);
  const selection = useEditorStore((s) => s.selection);
  const tool = useEditorStore((s) => s.tool);
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
    };
  }, [actions, page.index]);

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
        created = factory.create(host, {
          onSelect: (ids) => callbacksRef.current?.onSelect(ids),
          onTransform: (id, display, kind) => callbacksRef.current?.onTransform(id, display, kind),
          onDraw: (drawTool, display, constrained) =>
            callbacksRef.current?.onDraw(drawTool, display, constrained),
        });
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
  }, [loadObjectLayers]);

  useEffect(() => {
    layer?.setSize(size.width, size.height, zoom);
  }, [layer, size, zoom]);

  useEffect(() => {
    layer?.setObjects(layerObjects);
  }, [layer, layerObjects]);

  useEffect(() => {
    const onThisPage = new Set(layerObjects.map(({ object }) => object.id));
    layer?.setSelection(selection.filter((id) => onThisPage.has(id)));
  }, [layer, selection, layerObjects]);

  useEffect(() => {
    layer?.setTool(tool);
  }, [layer, tool]);

  // Let the mouse through to the text layer unless it is over an object or a tool is drawing.
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
    <div ref={hostRef} className="absolute inset-0" data-testid={`object-layer-${page.index}`} />
  );
}
