import { describe, expect, it } from 'vitest';
import {
  applyToPoint,
  applyToRect,
  compose,
  IDENTITY,
  invert,
  multiply,
  scale,
  translate,
} from './matrix';

describe('matrix', () => {
  it('identity leaves points unchanged', () => {
    expect(applyToPoint(IDENTITY, { x: 3, y: -4 })).toEqual({ x: 3, y: -4 });
  });

  it('applies the first matrix before the second', () => {
    const m = multiply(translate(10, 0), scale(2));
    expect(applyToPoint(m, { x: 1, y: 1 })).toEqual({ x: 22, y: 2 });
  });

  it('compose applies left to right', () => {
    const m = compose(scale(2), translate(5, 5));
    expect(applyToPoint(m, { x: 1, y: 1 })).toEqual({ x: 7, y: 7 });
  });

  it('inverse undoes the transform', () => {
    const m = compose(translate(12, -7), scale(3, 2), [0, 1, -1, 0, 40, 0]);
    const p = { x: 13.5, y: 2.25 };
    const back = applyToPoint(invert(m), applyToPoint(m, p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it('throws for a singular matrix', () => {
    expect(() => invert([0, 0, 0, 0, 0, 0])).toThrow(RangeError);
  });

  it('returns the bounding box of a rotated rectangle', () => {
    const rotate90: [number, number, number, number, number, number] = [0, 1, -1, 0, 0, 0];
    expect(applyToRect(rotate90, { x: 0, y: 0, width: 10, height: 4 })).toEqual({
      x: -4,
      y: 0,
      width: 4,
      height: 10,
    });
  });
});
