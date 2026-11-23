import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import * as mupdf from 'mupdf';
import { polishPdf } from '../tests/fixtures/pdfFactory';
import { dropPdf, renderedPage, trackProblems, waitForEngine } from './helpers';

/** Forces the download path (as in Firefox), so the saved file can be inspected by the test. */
async function disableFilePickers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker');
    Reflect.deleteProperty(window, 'showOpenFilePicker');
  });
}

async function openTestPdf(page: Page): Promise<void> {
  await page.goto('./');
  await waitForEngine(page);
  await dropPdf(page, polishPdf(), 'edycja.pdf');
  await expect(renderedPage(page, 0)).toBeVisible();
  await page.getByRole('button', { name: /Powiększenie/ }).click();
  await page.getByRole('menuitem', { name: '100%' }).click();
  await expect(page.getByTestId('zoom-value')).toHaveText('100%');
}

/** Screen position of a point given in page display points (zoom 100%). */
async function pagePoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('[data-page-index="0"]').boundingBox();
  if (box === null) {
    throw new Error('page not visible');
  }
  return { x: box.x + x, y: box.y + y };
}

async function drawRectangle(
  page: Page,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  await page.keyboard.press('r');
  const start = await pagePoint(page, ...from);
  const end = await pagePoint(page, ...to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
}

async function propertyValue(page: Page, testId: string): Promise<number> {
  return Number((await page.getByTestId(testId).inputValue()).replace(',', '.'));
}

/** Mouse positions land on whole CSS pixels, so positions are compared within one point. */
async function expectProperty(page: Page, testId: string, expected: number): Promise<void> {
  await expect
    .poll(async () => Math.abs((await propertyValue(page, testId)) - expected))
    .toBeLessThanOrEqual(1);
}

test('draws, selects, moves, undoes and redoes a rectangle', async ({ page }) => {
  const problems = trackProblems(page);
  await openTestPdf(page);
  await drawRectangle(page, [100, 300], [300, 400]);

  await expect(page.getByTestId('properties-panel')).toContainText('Prostokąt');
  await expectProperty(page, 'prop-x', 100);
  await expectProperty(page, 'prop-width', 200);
  await expect(page.getByTestId('dirty-marker')).toBeVisible();
  await expect(page).toHaveTitle(/^\* edycja\.pdf/);

  // Drag the rectangle from its middle 50 points to the right (empty inside still grabs it).
  const grab = await pagePoint(page, 200, 350);
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 25, grab.y, { steps: 3 });
  await page.mouse.move(grab.x + 50, grab.y, { steps: 3 });
  await page.mouse.up();
  await expectProperty(page, 'prop-x', 150);

  await page.keyboard.press('Control+z');
  await expectProperty(page, 'prop-x', 100);
  await page.keyboard.press('Control+y');
  await expectProperty(page, 'prop-x', 150);

  // Arrow keys nudge; Shift makes a bigger step.
  await page.keyboard.press('Shift+ArrowDown');
  await expectProperty(page, 'prop-y', 310);

  // Undo everything, including the creation.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Control+z');
  }
  await expect(page.getByTestId('properties-panel')).toContainText('Zaznacz obiekt');
  await expect(page.getByTestId('undo')).toBeDisabled();
  await expect(page.getByTestId('dirty-marker')).toBeHidden();
  expect(problems).toEqual([]);
});

test('edits properties, duplicates, deletes and keeps text selectable', async ({ page }) => {
  await openTestPdf(page);
  await drawRectangle(page, [100, 300], [200, 350]);
  await page.getByTestId('prop-width').fill('150');
  await page.getByTestId('prop-width').press('Enter');
  await expect.poll(() => propertyValue(page, 'prop-width')).toBe(150);

  const x = await propertyValue(page, 'prop-x');
  await page.getByRole('button', { name: 'Duplikuj' }).click();
  await expectProperty(page, 'prop-x', x + 12);
  await page.getByTestId('document-view').focus();
  await page.keyboard.press('Control+d');
  await expectProperty(page, 'prop-x', x + 24);
  await page.getByRole('button', { name: 'Usuń' }).click();
  await expect(page.getByTestId('properties-panel')).toContainText('Zaznacz obiekt');

  // Text outside objects can still be selected with the mouse.
  const line = page.locator('[data-page-index="0"] .text-layer span', { hasText: 'Zażółć' });
  await line.selectText();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toContain('Zażółć');
});

test('saves as a download with the rectangle drawn into the PDF', async ({ page }) => {
  await disableFilePickers(page);
  await openTestPdf(page);
  await drawRectangle(page, [100, 300], [300, 400]);
  await page.getByTestId('prop-fill').waitFor();
  await page.getByRole('checkbox', { name: 'Bez wypełnienia' }).uncheck();

  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('edycja.pdf');
  await expect(page.getByTestId('save-notice')).toContainText('pobrany');
  await expect(page.getByTestId('dirty-marker')).toBeHidden();

  const bytes = new Uint8Array(readFileSync(await download.path()));
  const doc = new mupdf.PDFDocument(bytes);
  const pix = doc.loadPage(0).toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false);
  const width = pix.getWidth();
  const pixels = pix.getPixels();
  const at = (x: number, y: number): number[] =>
    Array.from(pixels.slice((y * width + x) * 3, (y * width + x) * 3 + 3));
  // Inside: the default fill colour (#fde68a); outside: white paper.
  expect(at(200, 350)).toEqual([0xfd, 0xe6, 0x8a]);
  expect(at(200, 450)).toEqual([255, 255, 255]);
  expect(doc.loadPage(0).toStructuredText('preserve-whitespace').asText()).toContain('Zażółć gęślą jaźń');
});

test('saves in place with the File System Access API when the file came from a picker', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const written: number[] = [];
    const handle = {
      name: 'z-dysku.pdf',
      queryPermission: () => Promise.resolve('prompt'),
      requestPermission: () => Promise.resolve('granted'),
      getFile: () =>
        fetch('./przyklad.pdf').then(async (r) => new File([await r.arrayBuffer()], 'z-dysku.pdf')),
      createWritable: () =>
        Promise.resolve({
          write: (data: ArrayBuffer) => {
            written.push(data.byteLength);
            return Promise.resolve();
          },
          close: () => Promise.resolve(),
        }),
    };
    Object.assign(window, {
      showOpenFilePicker: () => Promise.resolve([handle]),
      showSaveFilePicker: () => Promise.reject(new Error('should not be asked')),
      __written: written,
    });
  });
  await page.goto('./');
  await waitForEngine(page);
  await page.getByRole('button', { name: 'Otwórz PDF' }).click();
  await expect(page.getByTestId('file-name')).toHaveText('z-dysku.pdf');
  await expect(renderedPage(page, 0)).toBeVisible();
  await drawRectangle(page, [100, 300], [200, 350]);
  await page.keyboard.press('Control+s');
  await expect(page.getByTestId('save-notice')).toContainText('Zapisano „z-dysku.pdf”');
  const written = await page.evaluate(
    () => (window as unknown as { __written: number[] }).__written,
  );
  expect(written).toHaveLength(1);
  expect(written[0]).toBeGreaterThan(1000);
});

test('asks before losing unsaved changes', async ({ page }) => {
  await openTestPdf(page);
  await drawRectangle(page, [100, 300], [200, 350]);
  await page.getByRole('button', { name: 'Zamknij plik' }).click();
  const dialog = page.getByRole('dialog', { name: 'Masz niezapisane zmiany' });
  await dialog.getByRole('button', { name: 'Wróć do edycji' }).click();
  await expect(page.getByTestId('file-name')).toHaveText('edycja.pdf');

  let beforeUnloadShown = false;
  page.on('dialog', (browserDialog) => {
    beforeUnloadShown = browserDialog.type() === 'beforeunload';
    void browserDialog.dismiss();
  });
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => beforeUnloadShown).toBe(true);
});
