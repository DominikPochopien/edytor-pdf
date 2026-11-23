import type { Matrix, Point, Rect } from './types';

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function translate(tx: number, ty: number): Matrix {
  return [1, 0, 0, 1, tx, ty];
}

export function scale(sx: number, sy: number = sx): Matrix {
  return [sx, 0, 0, sy, 0, 0];
}

/** Returns the matrix that applies `first` and then `second`. */
export function multiply(first: Matrix, second: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = first;
  const [a2, b2, c2, d2, e2, f2] = second;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

/** Composes matrices left to right: compose(A, B, C) applies A, then B, then C. */
export function compose(...matrices: readonly Matrix[]): Matrix {
  return matrices.reduce<Matrix>((acc, m) => multiply(acc, m), IDENTITY);
}

export function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m;
  const determinant = a * d - b * c;
  if (determinant === 0) {
    throw new RangeError('Matrix is not invertible');
  }
  const ia = d / determinant;
  const ib = -b / determinant;
  const ic = -c / determinant;
  const id = a / determinant;
  return [ia, ib, ic, id, -e * ia - f * ic, -e * ib - f * id];
}

export function applyToPoint(m: Matrix, p: Point): Point {
  const [a, b, c, d, e, f] = m;
  return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f };
}

/** Transforms a rectangle and returns the axis-aligned bounding box of the result. */
export function applyToRect(m: Matrix, r: Rect): Rect {
  const corners = [
    applyToPoint(m, { x: r.x, y: r.y }),
    applyToPoint(m, { x: r.x + r.width, y: r.y }),
    applyToPoint(m, { x: r.x, y: r.y + r.height }),
    applyToPoint(m, { x: r.x + r.width, y: r.y + r.height }),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}
