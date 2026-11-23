// Stage 2 spike: draw objects with a PDF DocumentWriter, then embed the result as a Form XObject.
import * as mupdf from 'mupdf';
import fs from 'node:fs';
const src = fs.readFileSync('public/przyklad.pdf');
const font = new mupdf.Font('NotoSans', fs.readFileSync('public/fonts/NotoSans-Regular.ttf'));

function embed(doc, pageIndex, draw) {
  const pageObj = doc.findPage(pageIndex);
  const mb = pageObj.getInheritable('MediaBox').asJS();
  const [x0, y0, x1, y1] = mb;
  const W = x1 - x0, H = y1 - y0;
  const buf = new mupdf.Buffer();
  const writer = new mupdf.DocumentWriter(buf, 'pdf', '');
  const dev = writer.beginPage([0, 0, W, H]);
  draw(dev, W, H);
  writer.endPage();
  writer.close();
  const tmp = new mupdf.PDFDocument(buf);
  const tmpPage = tmp.findPage(0);
  const contents = tmpPage.get('Contents');
  let content = '';
  const streams = contents.isArray() ? Array.from({length: contents.length}, (_, i) => contents.get(i)) : [contents];
  const parts = streams.map(s => s.readStream().asUint8Array());
  const total = new Uint8Array(parts.reduce((a,p)=>a+p.length+1,0)); let o=0; for (const p of parts){ total.set(p,o); o+=p.length; total[o++]=10; }
  const resources = doc.graftObject(tmpPage.get('Resources'));
  const form = doc.addStream(total, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, W, H], Matrix: [1, 0, 0, 1, x0, y0], Resources: resources });
  let res = pageObj.getInheritable('Resources');
  if (res.isNull()) { res = doc.newDictionary(); }
  // copy-on-write: page-level Resources dict
  const own = doc.newDictionary();
  res.forEach((v, k) => own.put(k, v));
  let xo = own.get('XObject');
  const xoOwn = doc.newDictionary();
  if (!xo.isNull()) xo.forEach((v, k) => xoOwn.put(k, v));
  xoOwn.put('EdytorPdfObjects', form);
  own.put('XObject', xoOwn);
  pageObj.put('Resources', own);
  const pre = doc.addStream('q\n', {});
  const post = doc.addStream('Q\nq /EdytorPdfObjects Do Q\n', {});
  const c = pageObj.get('Contents');
  const arr = doc.newArray(); arr.push(pre);
  if (c.isArray()) c.forEach(x => arr.push(x)); else if (!c.isNull()) arr.push(c);
  arr.push(post);
  pageObj.put('Contents', arr);
}

for (const [rotate, crop, media] of [[0,null,null],[90,null,null],[180,[50,60,500,800],null],[270,null,[100,200,695.276,1041.89]]]) {
  const doc = new mupdf.PDFDocument(src);
  const po = doc.findPage(0);
  if (media) { po.put('MediaBox', media); /* shift content too? not needed for test */ }
  if (crop) po.put('CropBox', crop);
  po.put('Rotate', rotate);
  // target position: we want the object's center at fitz (200,150) of the displayed page
  const page = doc.loadPage(0);
  const pageCtm = page.getTransform(); // PDF -> fitz
  const mb = po.getInheritable('MediaBox').asJS();
  const [x0, y0, , y1] = mb;
  // writer space (down, mediabox-relative) -> PDF: (u, v) -> (u + x0, y1 - v)
  const downToPdf = [1, 0, 0, -1, x0, y1];
  const downToFitz = mupdf.Matrix.concat(downToPdf, pageCtm);
  const fitzToDown = mupdf.Matrix.invert(downToFitz);
  embed(doc, 0, (dev) => {
    const path = new mupdf.Path(); path.rect(-50, -20, 50, 20);
    const obj = mupdf.Matrix.concat(mupdf.Matrix.concat(mupdf.Matrix.rotate(30), mupdf.Matrix.translate(200, 150)), fitzToDown);
    dev.fillPath(path, false, obj, mupdf.ColorSpace.DeviceRGB, [1, 0, 0], 1);
    const text = new mupdf.Text();
    text.showString(font, mupdf.Matrix.concat(mupdf.Matrix.scale(14, -14), mupdf.Matrix.translate(0,0)), 'Zażółć');
    // text: in fitz, at (150,300), upright
    const tctm = mupdf.Matrix.concat(mupdf.Matrix.concat(mupdf.Matrix.scale(1,-1), mupdf.Matrix.translate(150, 300)), fitzToDown);
    dev.fillText(text, tctm, mupdf.ColorSpace.DeviceRGB, [0,0,1], 1);
  });
  const out = doc.saveToBuffer('garbage=compact,compress').asUint8Array();
  const re = new mupdf.PDFDocument(out);
  const rp = re.loadPage(0);
  const pix = rp.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false);
  const w = pix.getWidth(), px = pix.getPixels();
  const b = rp.getBounds();
  const at = (x, y) => Array.from(px.slice(((y - Math.round(b[1]))*w + (x-Math.round(b[0])))*3, ((y- Math.round(b[1]))*w + (x-Math.round(b[0])))*3+3));
  const t = rp.toStructuredText().asText();
  fs.writeFileSync(`scripts/spike/out/writer-${rotate}.pdf`, out);
  console.log(rotate, 'bounds', b.map(Math.round), 'center', at(200 + Math.round(b[0]), 150 + Math.round(b[1])), 'text ok', t.includes('Zażółć'), 'orig text', t.includes('Zadanie'));
}
