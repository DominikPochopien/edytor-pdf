/** Parses what the user typed into the "go to page" box. Returns a 0-based index or null. */
export function parsePageInput(input: string, pageCount: number): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const pageNumber = Number.parseInt(trimmed, 10);
  if (pageNumber < 1 || pageNumber > pageCount) {
    return null;
  }
  return pageNumber - 1;
}
