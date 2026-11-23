import { expect, test } from '@playwright/test';
import { polishPdf } from '../tests/fixtures/pdfFactory';
import { dropPdf, renderedPage, trackProblems, waitForEngine } from './helpers';

// Runs against the published site: E2E_BASE_URL=https://<user>.github.io/<repo>/ npx playwright test
test('published app opens and renders a PDF', async ({ page }) => {
  const problems = trackProblems(page);
  await page.goto('./');
  await waitForEngine(page);
  await page.getByRole('button', { name: 'Wypróbuj na przykładowym pliku' }).click();
  await expect(renderedPage(page, 0)).toBeVisible();
  await dropPdf(page, polishPdf(), 'test.pdf');
  await expect(page.locator('[data-page-index="0"] .text-layer')).toContainText(
    'Zażółć gęślą jaźń',
  );
  expect(problems).toEqual([]);
});
