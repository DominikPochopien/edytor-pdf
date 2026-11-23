import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import * as mupdf from 'mupdf';
import {
  disableFilePickers,
  expectProperty,
  openTestPdf,
  pagePoint,
  saveAndDownload,
  trackProblems,
} from './helpers';

function savedChars(bytes: Uint8Array): {
  text: string;
  fonts: Set<string>;
  first: (s: string) => { x: number; y: number };
} {
  const doc = new mupdf.PDFDocument(bytes);
  const chars: { c: string; x: number; y: number; font: string }[] = [];
  doc
    .loadPage(0)
    .toStructuredText('preserve-whitespace')
    .walk({
      onChar: (c, origin, font) => {
        chars.push({ c, x: origin[0], y: origin[1], font: font.getName() });
      },
    });
  const text = chars.map((c) => c.c).join('');
  return {
    text,
    fonts: new Set(chars.map((c) => c.font)),
    first: (s) => {
      const at = text.indexOf(s);
      const char = chars[at];
      if (char === undefined) {
        throw new Error(`"${s}" not in "${text}"`);
      }
      return { x: char.x, y: char.y };
    },
  };
}

test('adds text with Polish letters by clicking, then saves it into the PDF', async ({ page }) => {
  const problems = trackProblems(page);
  await disableFilePickers(page);
  await openTestPdf(page);
  await page.keyboard.press('t');
  const at = await pagePoint(page, 100, 300);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.type('Zażółć gęślą jaźń ĄĆĘŁŃÓŚŹŻ');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('properties-panel')).toContainText('Tekst');
  await expectProperty(page, 'prop-x', 100);
  await expectProperty(page, 'prop-y', 300);

  await page.getByTestId('prop-font-size').fill('18');
  await page.getByTestId('prop-font-size').press('Enter');
  await page.getByRole('button', { name: 'Pogrubienie' }).click();
  await expect(page.getByRole('button', { name: 'Pogrubienie' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const saved = savedChars(await saveAndDownload(page));
  // At 18 pt the sentence wraps inside the default box, so the two parts follow each other.
  expect(saved.text).toContain('Zażółć gęślą jaźńĄĆĘŁŃÓŚŹŻ');
  expect(
    [...saved.fonts].filter((name) => /^[A-Z]{6}\+.*bold/i.test(name)),
    [...saved.fonts].join(),
  ).not.toEqual([]);
  const origin = saved.first('Zażółć gęślą jaźńĄĆĘŁŃÓŚŹŻ');
  expect(Math.abs(origin.x - 100)).toBeLessThan(2);
  // Baseline of an 18 pt line about 15.9 pt below the top of the box.
  expect(Math.abs(origin.y - (300 + 18 * 1.13 * 0.778))).toBeLessThan(2);
  expect(problems).toEqual([]);
});

test('edits existing text and undoes the edit', async ({ page }) => {
  await openTestPdf(page);
  await page.keyboard.press('t');
  const at = await pagePoint(page, 100, 300);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.type('pierwsza wersja');
  await page.keyboard.press('Escape');

  const inside = await pagePoint(page, 120, 308);
  await page.mouse.dblclick(inside.x, inside.y);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('druga wersja – źdźbło');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('undo')).toHaveAttribute('aria-label', 'Cofnij: edycja tekstu');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('redo')).toBeEnabled();
});

test('wraps text in the box exactly like the screen and uses Latin Modern', async ({ page }) => {
  await disableFilePickers(page);
  await openTestPdf(page);
  await page.keyboard.press('t');
  const at = await pagePoint(page, 100, 300);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.type(
    'To jest dłuższy tekst, który na pewno nie zmieści się w jednej linii ramki.',
  );
  await page.keyboard.press('Escape');
  await page.getByTestId('prop-font').selectOption('latin-modern');
  await page.getByTestId('prop-width').fill('150');
  await page.getByTestId('prop-width').press('Enter');
  await expectProperty(page, 'prop-width', 150);

  const saved = savedChars(await saveAndDownload(page));
  expect([...saved.fonts].some((name) => name.includes('LMRoman10'))).toBe(true);
  // Several lines: the text was wrapped inside the 150 pt box.
  const first = saved.first('To jest');
  const last = saved.first('ramki.');
  expect(last.y - first.y).toBeGreaterThan(20);
  // Every line starts inside the 150 pt box.
  expect(last.x).toBeLessThan(100 + 150);
});

test('loads an own font file and uses it', async ({ page }) => {
  await disableFilePickers(page);
  await openTestPdf(page);
  await page.keyboard.press('t');
  const at = await pagePoint(page, 100, 300);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.type('Własny font: ąęł');
  await page.keyboard.press('Escape');
  const font = readFileSync('public/fonts/open-sans/OpenSans-regular.ttf');
  await page
    .getByTestId('font-file-input')
    .setInputFiles({ name: 'MojaCzcionka.ttf', mimeType: 'font/ttf', buffer: font });
  await expect(page.getByTestId('font-message')).toHaveText('Dodano font „MojaCzcionka”.');
  await expect(page.getByTestId('prop-font')).toHaveValue(/custom-/);
  const saved = savedChars(await saveAndDownload(page));
  expect(saved.text).toContain('Własny font: ąęł');
});

test('whiteout covers text, warns that it only covers, and picks the page colour', async ({
  page,
}) => {
  await disableFilePickers(page);
  await openTestPdf(page);
  await page.keyboard.press('w');
  const from = await pagePoint(page, 60, 85);
  const to = await pagePoint(page, 450, 110);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('whiteout-warning')).toContainText('tylko zakrywa');

  await page.getByTestId('prop-whiteout-color').fill('#ff0000');
  await expect(page.getByTestId('prop-whiteout-color')).toHaveValue('#ff0000');
  await page.getByRole('button', { name: 'Pipeta' }).click();
  const paper = await pagePoint(page, 520, 500);
  await page.mouse.click(paper.x, paper.y);
  await expect(page.getByTestId('prop-whiteout-color')).toHaveValue('#ffffff');

  // Write on the whited-out area.
  await page.keyboard.press('t');
  const on = await pagePoint(page, 80, 90);
  await page.mouse.click(on.x, on.y);
  await page.keyboard.type('Nowy napis');
  await page.keyboard.press('Escape');

  const bytes = await saveAndDownload(page);
  const saved = savedChars(bytes);
  expect(saved.text).toContain('Nowy napis');
  // Whiteout does not remove the original text – the warning in the panel says so.
  expect(saved.text).toContain('Zażółć gęślą jaźń');
});
