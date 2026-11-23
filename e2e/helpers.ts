import type { Page } from '@playwright/test';
import { polishPdf } from '../tests/fixtures/pdfFactory';
import { expect } from '@playwright/test';

/** Drops a PDF onto the window, the same way a user drags a file from the desktop. */
export async function dropPdf(page: Page, bytes: Uint8Array, name: string): Promise<void> {
  const data = Array.from(bytes);
  await page.evaluate(
    ({ data: content, name: fileName }) => {
      const file = new File([new Uint8Array(content)], fileName, { type: 'application/pdf' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      for (const type of ['dragenter', 'dragover', 'drop']) {
        window.dispatchEvent(
          new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }),
        );
      }
    },
    { data, name },
  );
}

export async function waitForEngine(page: Page): Promise<void> {
  await expect(page.getByTestId('engine-ready')).toBeVisible({ timeout: 30_000 });
}

export function renderedPage(page: Page, index: number) {
  return page.locator(`[data-page-index="${index}"] canvas[data-rendered="true"]`);
}

/** Collects Content-Security-Policy violations and page errors during a test. */
export function trackProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    problems.push(error.message);
  });
  return problems;
}

/** Forces the download path (as in Firefox), so the saved file can be inspected by the test. */
export async function disableFilePickers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker');
    Reflect.deleteProperty(window, 'showOpenFilePicker');
  });
}

export async function openTestPdf(page: Page): Promise<void> {
  await page.goto('./');
  await waitForEngine(page);
  await dropPdf(page, polishPdf(), 'edycja.pdf');
  await expect(renderedPage(page, 0)).toBeVisible();
  await page.getByRole('button', { name: /Powiększenie/ }).click();
  await page.getByRole('menuitem', { name: '100%' }).click();
  await expect(page.getByTestId('zoom-value')).toHaveText('100%');
}

/** Screen position of a point given in page display points (zoom 100%). */
export async function pagePoint(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const box = await page.locator('[data-page-index="0"]').boundingBox();
  if (box === null) {
    throw new Error('page not visible');
  }
  return { x: box.x + x, y: box.y + y };
}

export async function drawRectangle(
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

export async function propertyValue(page: Page, testId: string): Promise<number> {
  return Number((await page.getByTestId(testId).inputValue()).replace(',', '.'));
}

/** Mouse positions land on whole CSS pixels, so positions are compared within one point. */
export async function expectProperty(page: Page, testId: string, expected: number): Promise<void> {
  await expect
    .poll(async () => Math.abs((await propertyValue(page, testId)) - expected))
    .toBeLessThanOrEqual(1);
}

/** Saves with Ctrl+S (download path) and returns the saved file. */
export async function saveAndDownload(page: Page): Promise<Uint8Array> {
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const download = await downloadPromise;
  const { readFileSync } = await import('node:fs');
  return new Uint8Array(readFileSync(await download.path()));
}
