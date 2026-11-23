import { describe, expect, it, vi } from 'vitest';
import type { ShapeObject } from '../../domain/objects';
import { EditorSession, MAX_HISTORY } from './EditorSession';
import {
  AddObjectsCommand,
  RemoveObjectsCommand,
  ReorderObjectCommand,
  UpdateObjectsCommand,
} from './objectCommands';

function rect(id: string, x = 100): ShapeObject {
  return {
    id,
    kind: 'shape',
    shape: 'rectangle',
    pageIndex: 0,
    frame: { center: { x, y: 100 }, width: 10, height: 10, angle: 0 },
    opacity: 1,
    stroke: '#000000',
    fill: null,
    strokeWidth: 1,
  };
}

const ids = (session: EditorSession): string[] => session.snapshot.model.objects.map((o) => o.id);

describe('EditorSession (Undo/Redo)', () => {
  it('executes, undoes and redoes commands', () => {
    const session = new EditorSession();
    session.execute(new AddObjectsCommand([rect('a')]));
    session.execute(new AddObjectsCommand([rect('b')]));
    expect(ids(session)).toEqual(['a', 'b']);
    session.undo();
    expect(ids(session)).toEqual(['a']);
    expect(session.snapshot.canRedo).toBe(true);
    session.redo();
    expect(ids(session)).toEqual(['a', 'b']);
    session.undo();
    session.undo();
    expect(ids(session)).toEqual([]);
    expect(session.snapshot.canUndo).toBe(false);
  });

  it('clears redo after a new change', () => {
    const session = new EditorSession();
    session.execute(new AddObjectsCommand([rect('a')]));
    session.undo();
    session.execute(new AddObjectsCommand([rect('b')]));
    expect(session.snapshot.canRedo).toBe(false);
    expect(ids(session)).toEqual(['b']);
  });

  it('restores removed objects at their stacking position', () => {
    const session = new EditorSession();
    session.execute(new AddObjectsCommand([rect('a'), rect('b'), rect('c')]));
    session.execute(new RemoveObjectsCommand(session.snapshot.model, ['b']));
    expect(ids(session)).toEqual(['a', 'c']);
    session.undo();
    expect(ids(session)).toEqual(['a', 'b', 'c']);
  });

  it('undoes moves and stacking changes', () => {
    const session = new EditorSession();
    session.execute(new AddObjectsCommand([rect('a'), rect('b')]));
    session.execute(new UpdateObjectsCommand([rect('a')], [rect('a', 300)], 'move'));
    expect(session.snapshot.model.objects[0]?.frame.center.x).toBe(300);
    expect(session.snapshot.undoLabel).toBe('move');
    session.undo();
    expect(session.snapshot.model.objects[0]?.frame.center.x).toBe(100);
    session.execute(new ReorderObjectCommand('a', 0, 1));
    expect(ids(session)).toEqual(['b', 'a']);
    session.undo();
    expect(ids(session)).toEqual(['a', 'b']);
  });

  it('merges quick consecutive nudges into one undo step', () => {
    const session = new EditorSession();
    session.execute(new AddObjectsCommand([rect('a', 0)]));
    const merge = (at: number) => ({ key: 'nudge', at, windowMs: 1000 });
    session.execute(new UpdateObjectsCommand([rect('a', 0)], [rect('a', 1)], 'move', merge(0)));
    session.execute(new UpdateObjectsCommand([rect('a', 1)], [rect('a', 2)], 'move', merge(200)));
    session.execute(new UpdateObjectsCommand([rect('a', 2)], [rect('a', 3)], 'move', merge(400)));
    session.undo();
    expect(session.snapshot.model.objects[0]?.frame.center.x).toBe(0);
    session.redo();
    // A later nudge, outside the window, is a separate step.
    session.execute(new UpdateObjectsCommand([rect('a', 3)], [rect('a', 4)], 'move', merge(5000)));
    session.undo();
    expect(session.snapshot.model.objects[0]?.frame.center.x).toBe(3);
  });

  it('tracks unsaved changes, including undo back to the saved state', () => {
    const session = new EditorSession();
    expect(session.snapshot.dirty).toBe(false);
    session.execute(new AddObjectsCommand([rect('a')]));
    expect(session.snapshot.dirty).toBe(true);
    session.markSaved();
    expect(session.snapshot.dirty).toBe(false);
    session.execute(new AddObjectsCommand([rect('b')]));
    expect(session.snapshot.dirty).toBe(true);
    session.undo();
    expect(session.snapshot.dirty).toBe(false);
    session.undo();
    expect(session.snapshot.dirty).toBe(true);
    // A new change from here makes the saved state unreachable.
    session.execute(new AddObjectsCommand([rect('c')]));
    session.undo();
    expect(session.snapshot.dirty).toBe(true);
  });

  it('notifies listeners and resets', () => {
    const session = new EditorSession();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    session.execute(new AddObjectsCommand([rect('a')]));
    expect(listener).toHaveBeenCalledTimes(1);
    session.reset();
    expect(ids(session)).toEqual([]);
    expect(session.snapshot.canUndo).toBe(false);
    unsubscribe();
    session.execute(new AddObjectsCommand([rect('b')]));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it(`keeps at most ${MAX_HISTORY} undo steps`, () => {
    const session = new EditorSession();
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      session.execute(new AddObjectsCommand([rect(`o${i}`)]));
    }
    let undone = 0;
    while (session.snapshot.canUndo) {
      session.undo();
      undone += 1;
    }
    expect(undone).toBe(MAX_HISTORY);
  });
});
