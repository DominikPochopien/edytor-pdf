import type * as Mupdf from 'mupdf';
import type { EditObject, ShapeObject } from '../../domain/objects';
import { hexToRgb } from '../../domain/objects';
import type { MupdfModule } from './MupdfEngine';

const MITER_LIMIT = 10;

/**
 * Matrix from an object's local space (origin at its centre, X right, Y down — the same
 * convention as the editing layer) to PDF space.
 */
export function localToPdf(mupdf: MupdfModule, object: EditObject): Mupdf.Matrix {
  const { center, angle } = object.frame;
  const { Matrix } = mupdf;
  return Matrix.concat(
    Matrix.concat(Matrix.scale(1, -1), Matrix.rotate(angle)),
    Matrix.translate(center.x, center.y),
  );
}

function paintShape(
  mupdf: MupdfModule,
  device: Mupdf.Device,
  shape: ShapeObject,
  ctm: Mupdf.Matrix,
): void {
  const { width, height } = shape.frame;
  const path = new mupdf.Path();
  try {
    path.rect(-width / 2, -height / 2, width / 2, height / 2);
    const rgb = mupdf.ColorSpace.DeviceRGB;
    if (shape.fill !== null) {
      device.fillPath(path, false, ctm, rgb, hexToRgb(shape.fill), shape.opacity);
    }
    if (shape.stroke !== null && shape.strokeWidth > 0) {
      const stroke = new mupdf.StrokeState({
        lineCap: 'Butt',
        lineJoin: 'Miter',
        lineWidth: shape.strokeWidth,
        miterLimit: MITER_LIMIT,
      });
      device.strokePath(path, stroke, ctm, rgb, hexToRgb(shape.stroke), shape.opacity);
      stroke.destroy();
    }
  } finally {
    path.destroy();
  }
}

/** Draws one object onto a MuPDF device. `pdfToDevice` maps PDF space to the device space. */
export function paintObject(
  mupdf: MupdfModule,
  device: Mupdf.Device,
  object: EditObject,
  pdfToDevice: Mupdf.Matrix,
): void {
  const ctm = mupdf.Matrix.concat(localToPdf(mupdf, object), pdfToDevice);
  // Shapes are the only kind so far; text, ink and images get their painters in later stages.
  paintShape(mupdf, device, object, ctm);
}
