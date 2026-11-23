import type { Page } from '@playwright/test';
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
