import type * as Mupdf from 'mupdf';
import type { ExportResources } from '../../application/ports';
import type { EditObject } from '../../domain/objects';
import type { MupdfModule } from './MupdfEngine';
import { FontCache, paintObject } from './objectPainter';

/** Options for the saved file: drop unused objects, compress streams. */
export const SAVE_OPTIONS = 'garbage=compact,compress';
const XOBJECT_PREFIX = 'EdytorPdf';
const NEWLINE = 0x0a;
/** A PDF rectangle is an array of four numbers. */
const PDF_RECT_LENGTH = 4;

export interface ExportSource {
  readonly bytes: Uint8Array;
  readonly password?: string;
}

function rectOf(object: Mupdf.PDFObject): [number, number, number, number] {
  const values = Array.from({ length: PDF_RECT_LENGTH }, (_, i) => object.get(i).asNumber());
  const [a = 0, b = 0, c = 0, d = 0] = values;
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}

function streamsOf(contents: Mupdf.PDFObject): Mupdf.PDFObject[] {
  if (contents.isArray()) {
    return Array.from({ length: contents.length }, (_, i) => contents.get(i));
  }
  return contents.isNull() ? [] : [contents];
}

function concatStreams(streams: readonly Mupdf.PDFObject[]): Uint8Array {
  const parts = streams.map((s) => s.readStream().asUint8Array().slice());
  const result = new Uint8Array(parts.reduce((sum, p) => sum + p.length + 1, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
    result[offset++] = NEWLINE;
  }
  return result;
}

/**
 * Applies edit objects to a fresh copy of the original file and returns the bytes to save.
 *
 * Objects are drawn with MuPDF's PDF writer on a page the size of the MediaBox (Y down), and the
 * result is embedded in the real page as a Form XObject. This keeps fonts and images handled by
 * MuPDF and works the same for rotated pages, crop boxes and shifted media boxes.
 */
export class DocumentExporter {
  constructor(private readonly mupdf: MupdfModule) {}

  export(
    source: ExportSource,
    objects: readonly EditObject[],
    resources: ExportResources,
  ): Uint8Array {
    const doc = this.openCopy(source);
    const fonts = new FontCache(this.mupdf, resources.fonts);
    try {
      for (const [pageIndex, pageObjects] of this.groupByPage(objects)) {
        if (pageIndex >= 0 && pageIndex < doc.countPages()) {
          this.embedObjects(doc, pageIndex, pageObjects, fonts, resources);
        }
      }
      if (Object.keys(resources.fonts).length > 0) {
        // Keep only the glyphs that are used (Polish letters included).
        doc.subsetFonts();
      }
      // Copy out of WebAssembly memory immediately; later calls may reuse it.
      return doc.saveToBuffer(SAVE_OPTIONS).asUint8Array().slice();
    } finally {
      fonts.destroy();
      doc.destroy();
    }
  }

  private openCopy(source: ExportSource): Mupdf.PDFDocument {
    const doc = new this.mupdf.PDFDocument(source.bytes);
    if (doc.needsPassword() && doc.authenticatePassword(source.password ?? '') === 0) {
      doc.destroy();
      throw new Error('Cannot authenticate the copy of the document');
    }
    return doc;
  }

  private groupByPage(objects: readonly EditObject[]): Map<number, EditObject[]> {
    const pages = new Map<number, EditObject[]>();
    for (const object of objects) {
      pages.set(object.pageIndex, [...(pages.get(object.pageIndex) ?? []), object]);
    }
    return pages;
  }

  private embedObjects(
    doc: Mupdf.PDFDocument,
    pageIndex: number,
    objects: readonly EditObject[],
    fonts: FontCache,
    resources: ExportResources,
  ): void {
    const { Matrix } = this.mupdf;
    const pageObject = doc.findPage(pageIndex);
    const [x0, y0, x1, y1] = rectOf(pageObject.getInheritable('MediaBox'));
    const width = x1 - x0;
    const height = y1 - y0;
    // Writer space: origin at the MediaBox top-left, Y down. PDF → writer: (x − x0, y1 − y).
    const pdfToWriter = Matrix.invert([1, 0, 0, -1, x0, y1]);

    const form = this.drawForm(doc, width, height, (device) => {
      const context = { mupdf: this.mupdf, device, fonts, resources };
      for (const object of objects) {
        paintObject(context, object, pdfToWriter);
      }
    });
    form.put('Matrix', [1, 0, 0, 1, x0, y0]);
    const name = this.addXObject(doc, pageObject, form);
    this.appendContent(doc, pageObject, `q /${name} Do Q\n`);
  }

  private drawForm(
    doc: Mupdf.PDFDocument,
    width: number,
    height: number,
    draw: (device: Mupdf.Device) => void,
  ): Mupdf.PDFObject {
    const buffer = new this.mupdf.Buffer();
    const writer = new this.mupdf.DocumentWriter(buffer, 'pdf', '');
    const device = writer.beginPage([0, 0, width, height]);
    draw(device);
    writer.endPage();
    writer.close();
    const scratch = new this.mupdf.PDFDocument(buffer);
    try {
      const scratchPage = scratch.findPage(0);
      const content = concatStreams(streamsOf(scratchPage.get('Contents')));
      const resources = doc.graftObject(scratchPage.get('Resources'));
      return doc.addStream(content, {
        Type: 'XObject',
        Subtype: 'Form',
        BBox: [0, 0, width, height],
        Resources: resources,
      });
    } finally {
      scratch.destroy();
      writer.destroy();
      buffer.destroy();
    }
  }

  /** Adds the form to the page's own Resources (inherited dictionaries are copied, not changed). */
  private addXObject(
    doc: Mupdf.PDFDocument,
    pageObject: Mupdf.PDFObject,
    form: Mupdf.PDFObject,
  ): string {
    const inherited = pageObject.getInheritable('Resources');
    const resources = doc.newDictionary();
    if (!inherited.isNull()) {
      inherited.forEach((value, key) => {
        resources.put(key, value);
      });
    }
    const xobjects = doc.newDictionary();
    const existing = resources.get('XObject');
    if (!existing.isNull()) {
      existing.forEach((value, key) => {
        xobjects.put(key, value);
      });
    }
    let n = 0;
    while (!xobjects.get(`${XOBJECT_PREFIX}${n}`).isNull()) {
      n += 1;
    }
    const name = `${XOBJECT_PREFIX}${n}`;
    xobjects.put(name, form);
    resources.put('XObject', xobjects);
    pageObject.put('Resources', resources);
    return name;
  }

  /** Wraps the original content in q/Q (so its graphics state cannot leak) and appends ours. */
  private appendContent(
    doc: Mupdf.PDFDocument,
    pageObject: Mupdf.PDFObject,
    content: string,
  ): void {
    const contents = doc.newArray();
    contents.push(doc.addStream('q\n', {}));
    for (const stream of streamsOf(pageObject.get('Contents'))) {
      contents.push(stream);
    }
    contents.push(doc.addStream(`Q\n${content}`, {}));
    pageObject.put('Contents', contents);
  }
}
