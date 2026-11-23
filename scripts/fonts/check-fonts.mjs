// Checks that MuPDF can load every bundled font and that it has all Polish letters.
import fs from 'node:fs';
import path from 'node:path';
import * as mupdf from 'mupdf';

const root = 'public/fonts';
let failures = 0;
for (const family of fs.readdirSync(root)) {
  const dir = path.join(root, family);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const file of fs.readdirSync(dir)) {
    const font = new mupdf.Font(file, fs.readFileSync(path.join(dir, file)));
    const missing = [...'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ'].filter(
      (c) => font.encodeCharacter(c.codePointAt(0)) === 0,
    );
    const status = missing.length === 0 ? 'ok' : `MISSING ${missing.join('')}`;
    if (missing.length > 0) failures += 1;
    console.info(
      `${family}/${file}: ${font.getName()} bold=${font.isBold()} italic=${font.isItalic()} ${status}`,
    );
  }
}
process.exit(failures === 0 ? 0 : 1);
