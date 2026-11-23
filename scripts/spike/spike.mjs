// Spike: open PDF, render page, add Polish text, save, reopen, extract text.
import * as mupdf from "mupdf";
import fs from "node:fs";

fs.mkdirSync("scripts/spike/out", { recursive: true });
const POLISH = "Zażółć gęślą jaźń – ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż";
const src = fs.readFileSync("public/przyklad.pdf");
const fontData = fs.readFileSync("public/fonts/NotoSans-Regular.ttf");

function log(label, value) {
  console.log(`[${label}]`, value);
}

// 1. Open + render
const doc = mupdf.Document.openDocument(src, "application/pdf").asPDF();
log("pages", doc.countPages());
const page = doc.loadPage(0);
const bounds = page.getBounds();
log("bounds", bounds);
const pix = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true);
fs.writeFileSync("scripts/spike/out/render-p1.png", pix.asPNG());
log("render", `${pix.getWidth()}x${pix.getHeight()}`);

// 2a. Approach A: manual content stream, Identity-H CID font
const font = new mupdf.Font("NotoSans", fontData);
const fontRef = doc.addFont(font);
const pageObj = page.getObject();
let res = pageObj.get("Resources");
if (res.isNull()) { res = doc.newDictionary(); pageObj.put("Resources", res); }
let fonts = res.get("Font");
if (fonts.isNull()) { fonts = doc.newDictionary(); res.put("Font", fonts); }
fonts.put("FEd1", fontRef);
let hex = "";
for (const ch of POLISH) {
  const gid = font.encodeCharacter(ch.codePointAt(0));
  hex += gid.toString(16).padStart(4, "0");
}
const [, , , pageH] = bounds;
const yPdf = 60; // PDF space, origin bottom-left
const content = `q BT /FEd1 14 Tf 0.8 0 0 rg 1 0 0 1 72 ${yPdf} Tm <${hex}> Tj ET Q\n`;
const stream = doc.addStream(content, {});
const contents = pageObj.get("Contents");
if (contents.isArray()) contents.push(stream);
else { const arr = doc.newArray(); arr.push(contents); arr.push(stream); pageObj.put("Contents", arr); }
log("A: added content stream", true);

// 2b. Approach B: DisplayList -> Stamp appearance -> flatten via bake
const page2 = doc.loadPage(1);
const rect = [72, 100, 450, 130];
const list = new mupdf.DisplayList(rect);
const dev = new mupdf.DisplayListDevice(list);
const text = new mupdf.Text();
text.showString(font, mupdf.Matrix.concat(mupdf.Matrix.scale(14, -14), mupdf.Matrix.translate(76, 120)), POLISH);
dev.fillText(text, mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, [0, 0, 0.7], 1);
const path = new mupdf.Path();
path.rect(72, 100, 450, 130);
dev.strokePath(path, new mupdf.StrokeState({ lineCap: "Butt", lineJoin: "Miter", lineWidth: 1, miterLimit: 10 }), mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, [0, 0.5, 0], 1);
dev.close();
const annot = page2.createAnnotation("Stamp");
annot.setRect(rect);
annot.setAppearanceFromDisplayList(null, null, mupdf.Matrix.identity, list);
annot.update();
log("B: stamp created", annot.getRect());

// 3. Redaction test: remove "Instrukcja" text only (no black box), on page 1
const hits = page.search("Instrukcja dla", {});
log("search hits", hits.length);
const red = page.createAnnotation("Redact");
for (const quads of hits) for (const q of quads) red.addQuadPoint(q);
red.setRect(mupdf.Rect.transform([0,0,0,0], mupdf.Matrix.identity));
page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_REMOVE);
log("redaction applied", true);

// flatten only our stamp: bake all (sample has no other annots)
doc.bake(true, false);
doc.subsetFonts();
const out = doc.saveToBuffer("garbage=compact,compress").asUint8Array();
fs.writeFileSync("scripts/spike/out/spike-out.pdf", out);
log("saved bytes", out.length);

// 4. Reopen + extract
const doc2 = mupdf.Document.openDocument(out, "application/pdf");
const t1 = doc2.loadPage(0).toStructuredText("preserve-whitespace").asText();
const t2 = doc2.loadPage(1).toStructuredText("preserve-whitespace").asText();
log("A text found", t1.includes(POLISH));
log("B text found", t2.includes(POLISH));
log("redacted text gone", !t1.includes("Instrukcja dla"));
log("rest kept", t1.includes("Sprawdź, czy arkusz"));
log("annots after bake p2", doc2.asPDF().loadPage(1).getAnnotations().length);
fs.writeFileSync("scripts/spike/out/render-out-p1.png", doc2.loadPage(0).toPixmap(mupdf.Matrix.scale(1.5, 1.5), mupdf.ColorSpace.DeviceRGB, false, true).asPNG());
fs.writeFileSync("scripts/spike/out/render-out-p2.png", doc2.loadPage(1).toPixmap(mupdf.Matrix.scale(1.5, 1.5), mupdf.ColorSpace.DeviceRGB, false, true).asPNG());
