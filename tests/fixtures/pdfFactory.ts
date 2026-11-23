/**
 * Test PDFs generated in code with MuPDF (no binary fixtures in the repository).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as mupdf from 'mupdf';

export const POLISH_SENTENCE = 'Zażółć gęślą jaźń – ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż';
export const A4: [number, number, number, number] = [0, 0, 595, 842];

const FONT_PATH = fileURLToPath(
  new URL('../../public/fonts/NotoSans-Regular.ttf', import.meta.url),
);
const SAMPLE_PATH = fileURLToPath(new URL('../../public/przyklad.pdf', import.meta.url));

export function samplePdf(): Uint8Array {
  return new Uint8Array(readFileSync(SAMPLE_PATH));
}

interface TextRun {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly size?: number;
}

/** Builds a document whose pages contain the given text runs (PDF coordinates, Y up). */
class PdfBuilder {
  readonly doc = new mupdf.PDFDocument();
  private readonly font = new mupdf.Font('NotoSans', readFileSync(FONT_PATH));
  private readonly fontRef = this.doc.addFont(this.font);

  addPage(
    runs: readonly TextRun[],
    options: {
      mediaBox?: [number, number, number, number];
      rotate?: mupdf.Rotate;
      cropBox?: number[];
    } = {},
  ): this {
    const content = runs.map((run) => this.textOperator(run)).join('\n');
    const resources = this.doc.addObject({ Font: { F1: this.fontRef } });
    const page = this.doc.addPage(options.mediaBox ?? A4, options.rotate ?? 0, resources, content);
    if (options.cropBox !== undefined) {
      page.put('CropBox', options.cropBox);
    }
    this.doc.insertPage(-1, page);
    return this;
  }

  save(options = 'compress'): Uint8Array {
    this.doc.subsetFonts();
    return this.doc.saveToBuffer(options).asUint8Array().slice();
  }

  private textOperator(run: TextRun): string {
    let hex = '';
    for (const char of run.text) {
      hex += this.font
        .encodeCharacter(char.codePointAt(0) ?? 0)
        .toString(16)
        .padStart(4, '0');
    }
    return `BT /F1 ${run.size ?? 14} Tf 1 0 0 1 ${run.x} ${run.y} Tm <${hex}> Tj ET`;
  }
}

export function polishPdf(): Uint8Array {
  return new PdfBuilder()
    .addPage([
      { text: 'Arkusz testowy', x: 72, y: 780, size: 20 },
      { text: POLISH_SENTENCE, x: 72, y: 740 },
      { text: 'Druga linia: gęślą jaźń raz jeszcze', x: 72, y: 700 },
    ])
    .addPage([{ text: 'Strona druga – źdźbło', x: 72, y: 780 }])
    .save();
}

export function rotatedPdf(): Uint8Array {
  const builder = new PdfBuilder();
  for (const rotate of [0, 90, 180, 270] as const) {
    builder.addPage([{ text: `Obrót ${rotate}`, x: 72, y: 780 }], {
      rotate,
      cropBox: [20, 40, 520, 800],
    });
  }
  return builder.save();
}

export function encryptedPdf(password: string): Uint8Array {
  return new PdfBuilder()
    .addPage([{ text: 'Tajny dokument – ściśle poufne', x: 72, y: 780 }])
    .save(`compress,encrypt=aes-256,user-password=${password},owner-password=${password}`);
}

export function longPdf(pageCount: number): Uint8Array {
  const builder = new PdfBuilder();
  for (let i = 1; i <= pageCount; i++) {
    builder.addPage([
      { text: `Strona ${i} z ${pageCount}`, x: 72, y: 780 },
      { text: POLISH_SENTENCE, x: 72, y: 740, size: 11 },
    ]);
  }
  return builder.save();
}

export const EXTERNAL_LINK = 'https://example.com/matura';

export function linkPdf(): Uint8Array {
  const builder = new PdfBuilder()
    .addPage([{ text: 'Link zewnętrzny i wewnętrzny', x: 72, y: 780 }])
    .addPage([{ text: 'Cel linku', x: 72, y: 780 }]);
  const page = builder.doc.loadPage(0);
  page.createLink([72, 100, 300, 130], EXTERNAL_LINK);
  page.createLink([72, 150, 300, 180], '#page=2');
  return builder.save();
}

export function notPdfBytes(): Uint8Array {
  return new TextEncoder().encode('To nie jest PDF, tylko zwykły tekst.');
}

export function corruptedPdf(): Uint8Array {
  const valid = polishPdf();
  // Keep the header and destroy most of the body, including the cross-reference table.
  const broken = valid.slice(0, 200);
  broken.fill(0x41, 20);
  return broken;
}

/** A page with a sticky note made by "another program", to check that saving keeps it. */
export function annotatedPdf(): Uint8Array {
  const builder = new PdfBuilder().addPage([{ text: 'Strona z notatką', x: 72, y: 780 }]);
  const page = builder.doc.loadPage(0);
  const note = page.createAnnotation('Text');
  note.setRect([400, 100, 420, 120]);
  note.setContents('Notatka recenzenta');
  note.update();
  return builder.save();
}
