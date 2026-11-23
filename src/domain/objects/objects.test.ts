import { describe, expect, it } from 'vitest';
import type { PageInfo } from '../document';
import type { PageRotation } from '../geometry';
import { hexToRgb, isHexColor } from './color';
import { copiesForPaste, PASTE_OFFSET } from './clipboard';
import {
  displayToFrame,
  displayToView,
  frameToDisplay,
  moveFrameOnScreen,
  normalizeAngle,
  viewToDisplay,
} from './frame';
import {
  addObjects,
  EMPTY_MODEL,
  findObject,
  insertObjectsAt,
  moveObjectToIndex,
  objectsOnPage,
  removeObjects,
  replaceObjects,
} from './model';
import type { ShapeObject } from './types';

function page(rotation: PageRotation, index = 0): PageInfo {
  return { index, rotation, cropBox: { x: 0, y: 0, width: 595, height: 842 } };
}

function rect(id: string, pageIndex = 0, x = 100, y = 700): ShapeObject {
  return {
    id,
    kind: 'shape',
    shape: 'rectangle',
    pageIndex,
    frame: { center: { x, y }, width: 80, height: 40, angle: 0 },
    opacity: 1,
    stroke: '#dc2626',
    fill: null,
    strokeWidth: 2,
  };
}

describe('normalizeAngle', () => {
  it.each([
    [0, 0],
    [190, -170],
    [-190, 170],
    [180, 180],
    [-180, 180],
    [720, 0],
  ])('%d° → %d°', (input, expected) => {
    expect(normalizeAngle(input)).toBeCloseTo(expected);
  });
});

describe('object frames: PDF ↔ screen', () => {
  it('places an unrotated object with the Y axis flipped', () => {
    const display = frameToDisplay(rect('a').frame, page(0));
    expect(display.center).toEqual({ x: 100, y: 142 });
    expect(display.angle).toBe(0);
  });

  it('an object upright on the screen of a 90° page is rotated in PDF space', () => {
    const frame = displayToFrame(
      { center: { x: 100, y: 100 }, width: 50, height: 20, angle: 0 },
      page(90),
    );
    expect(frame.angle).toBe(90);
    // Shown at (100, 100) on a 90° page: PDF x = 100, PDF y = 100 from the bottom edge.
    expect(frame.center.x).toBeCloseTo(100);
    expect(frame.center.y).toBeCloseTo(100);
  });

  for (const rotation of [0, 90, 180, 270] as const) {
    it(`round-trips through the screen on a ${rotation}° page`, () => {
      const frame = { center: { x: 210.5, y: 333.25 }, width: 70, height: 30, angle: 25 };
      const back = displayToFrame(frameToDisplay(frame, page(rotation)), page(rotation));
      expect(back.center.x).toBeCloseTo(frame.center.x);
      expect(back.center.y).toBeCloseTo(frame.center.y);
      expect(back.angle).toBeCloseTo(frame.angle);
      expect(back.width).toBe(70);
    });
  }

  it('scales to view space with zoom and back', () => {
    const display = { center: { x: 10, y: 20 }, width: 30, height: 40, angle: 15 };
    const view = displayToView(display, 2);
    expect(view).toEqual({ center: { x: 20, y: 40 }, width: 60, height: 80, angle: 15 });
    expect(viewToDisplay(view, 2)).toEqual(display);
  });

  it('moves objects in screen directions, also on rotated pages', () => {
    const p = page(90);
    const moved = moveFrameOnScreen(rect('a').frame, p, 10, 0);
    const before = frameToDisplay(rect('a').frame, p).center;
    const after = frameToDisplay(moved, p).center;
    expect(after.x - before.x).toBeCloseTo(10);
    expect(after.y - before.y).toBeCloseTo(0);
  });
});

describe('edit model', () => {
  const model = addObjects(EMPTY_MODEL, [rect('a'), rect('b', 1), rect('c')]);

  it('finds and filters objects', () => {
    expect(findObject(model, 'b')?.pageIndex).toBe(1);
    expect(objectsOnPage(model, 0).map((o) => o.id)).toEqual(['a', 'c']);
  });

  it('removes and restores objects at their stacking position', () => {
    const removed = removeObjects(model, ['a', 'c']);
    expect(removed.objects.map((o) => o.id)).toEqual(['b']);
    const restored = insertObjectsAt(removed, [
      { object: rect('c'), index: 2 },
      { object: rect('a'), index: 0 },
    ]);
    expect(restored.objects.map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('replaces objects in place', () => {
    const updated = replaceObjects(model, [{ ...rect('b', 1), opacity: 0.5 }]);
    expect(updated.objects.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(findObject(updated, 'b')?.opacity).toBe(0.5);
  });

  it('changes the stacking order', () => {
    expect(moveObjectToIndex(model, 'a', 2).objects.map((o) => o.id)).toEqual(['b', 'c', 'a']);
    expect(moveObjectToIndex(model, 'c', 0).objects.map((o) => o.id)).toEqual(['c', 'a', 'b']);
    expect(moveObjectToIndex(model, 'missing', 0)).toBe(model);
  });
});

describe('clipboard', () => {
  let n = 0;
  const newId = (): string => `copy-${++n}`;

  it('shifts copies pasted on the same page', () => {
    const [copy] = copiesForPaste([rect('a')], page(0), newId);
    expect(copy?.id).toMatch(/^copy-/);
    const before = frameToDisplay(rect('a').frame, page(0)).center;
    const after = frameToDisplay(copy!.frame, page(0)).center;
    expect(after.x - before.x).toBeCloseTo(PASTE_OFFSET);
    expect(after.y - before.y).toBeCloseTo(PASTE_OFFSET);
  });

  it('keeps the position when pasting on another page', () => {
    const [copy] = copiesForPaste([rect('a')], page(0, 3), newId);
    expect(copy?.pageIndex).toBe(3);
    expect(copy?.frame).toEqual(rect('a').frame);
  });
});

describe('colours', () => {
  it('converts hex colours to PDF RGB', () => {
    expect(hexToRgb('#ff0080')).toEqual([1, 0, 128 / 255]);
    expect(isHexColor('#12abEF')).toBe(true);
    expect(isHexColor('red')).toBe(false);
    expect(() => hexToRgb('red')).toThrow(RangeError);
  });
});
