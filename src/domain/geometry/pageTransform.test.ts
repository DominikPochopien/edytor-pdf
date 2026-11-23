import { describe, expect, it } from 'vitest';
import { applyToPoint } from './matrix';
import {
  displaySize,
  normalizeRotation,
  pdfToDisplayMatrix,
  pdfToViewMatrix,
  viewToPdfMatrix,
} from './pageTransform';
import type { PageRotation, Point, Rect } from './types';

const A4: Rect = { x: 0, y: 0, width: 595, height: 842 };

function expectPoint(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe('normalizeRotation', () => {
  it.each([
    [0, 0],
    [90, 90],
    [360, 0],
    [450, 90],
    [-90, 270],
    [-180, 180],
    [89, 90],
  ])('%d° → %d°', (input, expected) => {
    expect(normalizeRotation(input)).toBe(expected);
  });
});

describe('displaySize', () => {
  it('keeps size for 0° and 180°', () => {
    expect(displaySize(A4, 0)).toEqual({ width: 595, height: 842 });
    expect(displaySize(A4, 180)).toEqual({ width: 595, height: 842 });
  });

  it('swaps width and height for 90° and 270°', () => {
    expect(displaySize(A4, 90)).toEqual({ width: 842, height: 595 });
    expect(displaySize(A4, 270)).toEqual({ width: 842, height: 595 });
  });
});

describe('pdfToDisplayMatrix', () => {
  // The PDF bottom-left corner of the page and where a reader sees it.
  const bottomLeft = { x: 0, y: 0 };
  const topLeft = { x: 0, y: 842 };

  it('flips the Y axis for an unrotated page', () => {
    const m = pdfToDisplayMatrix(A4, 0);
    expectPoint(applyToPoint(m, topLeft), { x: 0, y: 0 });
    expectPoint(applyToPoint(m, bottomLeft), { x: 0, y: 842 });
  });

  it('rotates 90° clockwise: the PDF top-left lands in the top-right corner', () => {
    const m = pdfToDisplayMatrix(A4, 90);
    expectPoint(applyToPoint(m, topLeft), { x: 842, y: 0 });
    expectPoint(applyToPoint(m, bottomLeft), { x: 0, y: 0 });
  });

  it('rotates 180°', () => {
    const m = pdfToDisplayMatrix(A4, 180);
    expectPoint(applyToPoint(m, topLeft), { x: 595, y: 842 });
    expectPoint(applyToPoint(m, bottomLeft), { x: 595, y: 0 });
  });

  it('rotates 270°', () => {
    const m = pdfToDisplayMatrix(A4, 270);
    expectPoint(applyToPoint(m, topLeft), { x: 0, y: 595 });
    expectPoint(applyToPoint(m, bottomLeft), { x: 842, y: 595 });
  });

  it('respects a crop box that does not start at the origin', () => {
    const crop: Rect = { x: 50, y: 100, width: 400, height: 500 };
    const m = pdfToDisplayMatrix(crop, 0);
    expectPoint(applyToPoint(m, { x: 50, y: 600 }), { x: 0, y: 0 });
    expectPoint(applyToPoint(m, { x: 450, y: 100 }), { x: 400, y: 500 });
  });
});

describe('view ↔ PDF round trip', () => {
  const rotations: PageRotation[] = [0, 90, 180, 270];
  const zooms = [0.5, 1, 1.75, 4];
  const crop: Rect = { x: 12, y: 30, width: 612, height: 792 };

  for (const rotation of rotations) {
    for (const zoom of zooms) {
      it(`returns to the same PDF point (rotation ${rotation}°, zoom ${zoom})`, () => {
        const p = { x: 100.25, y: 640.5 };
        const view = applyToPoint(pdfToViewMatrix(crop, rotation, zoom), p);
        const back = applyToPoint(viewToPdfMatrix(crop, rotation, zoom), view);
        expectPoint(back, p);
      });
    }
  }

  it('scales view coordinates by zoom', () => {
    const view = applyToPoint(pdfToViewMatrix(A4, 0, 2), { x: 10, y: 842 });
    expectPoint(view, { x: 20, y: 0 });
  });

  it('maps a click in the view to the right PDF point on a rotated page', () => {
    // On a 90° page shown at 150%, clicking the top-left view corner hits the PDF bottom-left.
    const pdf = applyToPoint(viewToPdfMatrix(A4, 90, 1.5), { x: 0, y: 0 });
    expectPoint(pdf, { x: 0, y: 0 });
  });
});
