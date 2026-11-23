import type * as Mupdf from 'mupdf';
import type { ExportResources, TextExportInfo } from '../../application/ports';
import type { EditObject, ShapeObject, TextObject, WhiteoutRect } from '../../domain/objects';
import {
  baselineOffset,
  hexToRgb,
  lineStart,
  UNDERLINE_OFFSET,
  UNDERLINE_THICKNESS,
} from '../../domain/objects';
import type { MupdfModule } from './MupdfEngine';

const MITER_LIMIT = 10;
const SPACE = ' ';

/** Loads each font file once per export. */
export class FontCache {
  private readonly fonts = new Map<string, Mupdf.Font>();

  constructor(
    private readonly mupdf: MupdfModule,
    private readonly files: ExportResources['fonts'],
  ) {}

  get(key: keyof ExportResources['fonts']): Mupdf.Font {
    const cached = this.fonts.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const bytes = this.files[key];
    if (bytes === undefined) {
      throw new Error(`Font ${key} was not provided`);
    }
    const font = new this.mupdf.Font(key.replace(':', '-'), bytes);
    this.fonts.set(key, font);
    return font;
  }

  destroy(): void {
    for (const font of this.fonts.values()) {
      font.destroy();
    }
    this.fonts.clear();
  }
}

export interface PaintContext {
  readonly mupdf: MupdfModule;
  readonly device: Mupdf.Device;
  readonly fonts: FontCache;
  readonly resources: ExportResources;
}

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

function rectanglePath(mupdf: MupdfModule, width: number, height: number): Mupdf.Path {
  const path = new mupdf.Path();
  path.rect(-width / 2, -height / 2, width / 2, height / 2);
  return path;
}

function paintShape({ mupdf, device }: PaintContext, shape: ShapeObject, ctm: Mupdf.Matrix): void {
  const path = rectanglePath(mupdf, shape.frame.width, shape.frame.height);
  try {
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

function paintWhiteout(
  { mupdf, device }: PaintContext,
  whiteout: WhiteoutRect,
  ctm: Mupdf.Matrix,
): void {
  const path = rectanglePath(mupdf, whiteout.frame.width, whiteout.frame.height);
  try {
    device.fillPath(
      path,
      false,
      ctm,
      mupdf.ColorSpace.DeviceRGB,
      hexToRgb(whiteout.color),
      whiteout.opacity,
    );
  } finally {
    path.destroy();
  }
}

/** Width of `text` set in `font` at `size`, without kerning (as MuPDF places the glyphs). */
function measure(font: Mupdf.Font, text: string, size: number): number {
  let width = 0;
  for (const char of text) {
    width += font.advanceGlyph(font.encodeCharacter(char.codePointAt(0) ?? 0)) * size;
  }
  return width;
}

function paintText(
  context: PaintContext,
  text: TextObject,
  ctm: Mupdf.Matrix,
  info: TextExportInfo,
): void {
  const { mupdf, device } = context;
  const { style, frame } = text;
  const font = context.fonts.get(info.font);
  const color = hexToRgb(style.color);
  const rgb = mupdf.ColorSpace.DeviceRGB;
  const left = -frame.width / 2;
  const top = -frame.height / 2;
  const glyphs = new mupdf.Text();
  const underline = new mupdf.Path();
  try {
    info.layout.lines.forEach((line, index) => {
      const baseline = top + baselineOffset(style.fontSize, style.lineHeight, index);
      const content = line.text.replace(/\s+$/u, '');
      const naturalWidth = measure(font, content, style.fontSize);
      const justify = style.align === 'justify' && !line.endsParagraph;
      const startX = left + lineStart(style.align, frame.width, justify ? frame.width : line.width);
      const words = content.split(SPACE);
      const gaps = words.length - 1;
      const extra = justify && gaps > 0 ? (frame.width - naturalWidth) / gaps : 0;
      let x = startX;
      words.forEach((word, i) => {
        // Glyph space has Y up; the local space has Y down, hence −fontSize.
        const advanced = glyphs.showString(
          font,
          [style.fontSize, 0, 0, -style.fontSize, x, baseline],
          word,
        );
        x = advanced[4];
        if (i < gaps) {
          x += measure(font, SPACE, style.fontSize) + extra;
        }
      });
      if (style.underline && content !== '') {
        const y = baseline + UNDERLINE_OFFSET * style.fontSize;
        const thickness = UNDERLINE_THICKNESS * style.fontSize;
        underline.rect(startX, y, x, y + thickness);
      }
    });
    device.fillText(glyphs, ctm, rgb, color, text.opacity);
    if (style.underline) {
      device.fillPath(underline, false, ctm, rgb, color, text.opacity);
    }
  } finally {
    glyphs.destroy();
    underline.destroy();
  }
}

/** Draws one object onto a MuPDF device. `pdfToDevice` maps PDF space to the device space. */
export function paintObject(
  context: PaintContext,
  object: EditObject,
  pdfToDevice: Mupdf.Matrix,
): void {
  const ctm = context.mupdf.Matrix.concat(localToPdf(context.mupdf, object), pdfToDevice);
  switch (object.kind) {
    case 'shape':
      paintShape(context, object, ctm);
      break;
    case 'whiteout':
      paintWhiteout(context, object, ctm);
      break;
    case 'text': {
      const info = context.resources.texts[object.id];
      if (info === undefined) {
        throw new Error(`Missing layout for text ${object.id}`);
      }
      paintText(context, object, ctm, info);
      break;
    }
  }
}
