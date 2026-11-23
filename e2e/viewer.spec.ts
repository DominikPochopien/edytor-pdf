import { expect, test } from '@playwright/test';
import {
  encryptedPdf,
  EXTERNAL_LINK,
  linkPdf,
  longPdf,
  notPdfBytes,
  polishPdf,
  rotatedPdf,
} from '../tests/fixtures/pdfFactory';
import { dropPdf, renderedPage, trackProblems, waitForEngine } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await waitForEngine(page);
});

test('welcome screen explains privacy and offers a sample', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Otwórz PDF' })).toBeVisible();
  await expect(page.getByText('Twoje pliki nie są nigdzie wysyłane')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kod źródłowy' })).toBeVisible();
});

test('opens the sample sheet without errors or CSP violations', async ({ page }) => {
  const problems = trackProblems(page);
  await page.getByRole('button', { name: 'Wypróbuj na przykładowym pliku' }).click();
  await expect(page.getByTestId('file-name')).toHaveText('przyklad-arkusz.pdf');
  await expect(page.getByTestId('page-count')).toHaveText('z 2');
  await expect(renderedPage(page, 0)).toBeVisible();
  await expect(page.locator('[data-page-index="0"] .text-layer')).toContainText(
    'zażółć gęślą jaźń',
  );
  expect(problems).toEqual([]);
});

test('opens a dropped PDF with Polish text, zooms and navigates', async ({ page }) => {
  await dropPdf(page, polishPdf(), 'polskie-znaki.pdf');
  await expect(page.getByTestId('file-name')).toHaveText('polskie-znaki.pdf');
  await expect(renderedPage(page, 0)).toBeVisible();
  await expect(page.locator('[data-page-index="0"] .text-layer')).toContainText(
    'Zażółć gęślą jaźń',
  );

  await page.getByRole('button', { name: 'Pomniejsz' }).click();
  await page.keyboard.press('Control+0');
  await expect(page.getByTestId('zoom-value')).toHaveText('100%');
  await page.getByRole('button', { name: 'Powiększ', exact: true }).click();
  await expect(page.getByTestId('zoom-value')).toHaveText('110%');

  await page.getByTestId('thumbnail-1').click();
  await expect(page.getByTestId('page-input')).toHaveValue('2');
});

test('fits width and page from the zoom menu', async ({ page }) => {
  await dropPdf(page, polishPdf(), 'a.pdf');
  await expect(renderedPage(page, 0)).toBeVisible();
  await page.getByRole('button', { name: /Powiększenie/ }).click();
  await page.getByRole('menuitem', { name: 'Dopasuj do strony' }).click();
  const box = await page.locator('[data-page-index="0"]').boundingBox();
  const view = await page.getByTestId('document-view').boundingBox();
  expect(box!.height).toBeLessThanOrEqual(view!.height);
});

test('searches with Ctrl+F and highlights hits', async ({ page }) => {
  await dropPdf(page, polishPdf(), 'a.pdf');
  await expect(renderedPage(page, 0)).toBeVisible();
  await page.getByTestId('document-view').click();
  await page.keyboard.press('Control+f');
  const input = page.getByRole('searchbox', { name: 'Szukany tekst' });
  await expect(input).toBeFocused();
  await input.fill('GĘŚLĄ');
  await expect(page.getByTestId('search-status')).toHaveText('Wynik 1 z 2');
  await expect(page.locator('.search-hit[data-active="true"]')).toHaveCount(1);
  await input.press('Enter');
  await expect(page.getByTestId('search-status')).toHaveText('Wynik 2 z 2');
});

test('asks for a password and rejects a wrong one', async ({ page }) => {
  const problems = trackProblems(page);
  await dropPdf(page, encryptedPdf('matura'), 'tajne.pdf');
  const dialog = page.getByRole('dialog', { name: 'Plik jest chroniony hasłem' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Hasło').fill('zle');
  await dialog.getByRole('button', { name: 'Otwórz' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Hasło jest nieprawidłowe. Spróbuj ponownie.');
  await dialog.getByLabel('Hasło').fill('matura');
  await dialog.getByRole('button', { name: 'Otwórz' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-page-index="0"] .text-layer')).toContainText('ściśle poufne');
  expect(problems).toEqual([]);
});

test('shows a clear message for a file that is not a PDF', async ({ page }) => {
  await dropPdf(page, notPdfBytes(), 'notatki.pdf');
  await expect(page.getByTestId('error-message')).toContainText('To nie jest plik PDF');
  await expect(page.getByRole('button', { name: 'Otwórz PDF' })).toBeVisible();
});

test('asks before opening a link from the PDF', async ({ page }) => {
  await dropPdf(page, linkPdf(), 'linki.pdf');
  await page.getByRole('button', { name: EXTERNAL_LINK }).click();
  const dialog = page.getByRole('dialog', { name: 'Otworzyć link?' });
  await expect(dialog.getByTestId('link-address')).toHaveText(EXTERNAL_LINK);
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Przejdź do strony 2' }).click();
  await expect(page.getByTestId('page-input')).toHaveValue('2');
});

test('renders rotated pages in landscape', async ({ page }) => {
  await dropPdf(page, rotatedPdf(), 'obrocone.pdf');
  await expect(renderedPage(page, 0)).toBeVisible();
  await page.getByTestId('page-input').fill('2');
  await page.getByTestId('page-input').press('Enter');
  const rotated = await page.locator('[data-page-index="1"]').boundingBox();
  expect(rotated!.width).toBeGreaterThan(rotated!.height);
});

test('300-page document: first page under 2 s, only visible pages in the DOM', async ({ page }) => {
  const bytes = longPdf(300);
  const started = Date.now();
  await dropPdf(page, bytes, 'dlugi.pdf');
  await expect(renderedPage(page, 0)).toBeVisible();
  expect(Date.now() - started).toBeLessThan(2000);
  await expect(page.getByTestId('page-count')).toHaveText('z 300');
  expect(await page.locator('[data-page-index]').count()).toBeLessThan(10);

  await page.getByTestId('page-input').fill('250');
  await page.getByTestId('page-input').press('Enter');
  await expect(renderedPage(page, 249)).toBeVisible();
  await expect(page.locator('[data-page-index="249"] .text-layer')).toContainText(
    'Strona 250 z 300',
  );
});

test('remembers recently opened files', async ({ page }) => {
  await dropPdf(page, polishPdf(), 'ostatni.pdf');
  await expect(renderedPage(page, 0)).toBeVisible();
  await page.getByRole('button', { name: 'Zamknij plik' }).click();
  const recent = page.getByRole('button', { name: 'Otwórz ostatni.pdf' });
  await expect(recent).toBeVisible();
  await recent.click();
  await expect(page.getByTestId('file-name')).toHaveText('ostatni.pdf');
});

test('shows keyboard shortcuts under "?"', async ({ page }) => {
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Skróty klawiszowe' })).toBeVisible();
});
