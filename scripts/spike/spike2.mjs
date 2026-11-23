import * as mupdf from "mupdf";
import fs from "node:fs";
const doc = mupdf.Document.openDocument(fs.readFileSync("public/przyklad.pdf"), "application/pdf");
const st = doc.loadPage(0).toStructuredText("preserve-spans");
let n=0; const seen=new Map();
st.walk({ onChar(c, origin, font, size, quad, color) {
  const k=font.getName(); if(!seen.has(k)) seen.set(k,{size, color, sample:c, bold:font.isBold(), italic:font.isItalic(), serif:font.isSerif(),
   hasZ: font.encodeCharacter(0x17c), hasQ: font.encodeCharacter("q".codePointAt(0)), hasLacute: font.encodeCharacter(0x105)});
}});
console.log(seen);
// JSON output check
const j = JSON.parse(st.asJSON()); console.log(Object.keys(j), j.blocks[0].lines[0]);
// password doc
const d = new mupdf.PDFDocument(); 
const p = d.addPage([0,0,200,200],0,{},"BT /F1 12 Tf 10 10 Td (x) Tj ET");
d.insertPage(-1,p);
const enc = d.saveToBuffer("encrypt=aes-256,user-password=tajne,owner-password=tajne").asUint8Array();
const e = mupdf.Document.openDocument(enc,"application/pdf");
console.log("needsPassword", e.needsPassword(), "bad", e.authenticatePassword("zle"), "good", e.authenticatePassword("tajne"), e.countPages());
console.log("JS supported:", doc.asPDF().isJSSupported());
