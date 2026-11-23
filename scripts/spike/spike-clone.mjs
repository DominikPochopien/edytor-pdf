import * as mupdf from 'mupdf';
import fs from 'node:fs';
const a = new mupdf.PDFDocument(fs.readFileSync('public/przyklad.pdf'));
const before = a.findPage(0).get('Contents').toString();
const b = new mupdf.PDFDocument(a);
b.findPage(0).put('Rotate', 90);
b.deletePage(1);
console.log('orig pages', a.countPages(), 'orig rotate', a.findPage(0).get('Rotate').toString(), 'copy pages', b.countPages(), 'contents same', a.findPage(0).get('Contents').toString() === before);
