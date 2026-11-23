import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** True when the qpdf command-line tool is installed (it is in CI). */
export const QPDF_AVAILABLE = spawnSync('qpdf', ['--version']).status === 0;

/** Runs `qpdf --check` on the bytes and returns its exit code (0 = no problems). */
export function qpdfCheck(
  bytes: Uint8Array,
  password?: string,
): { status: number | null; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'edytor-pdf-'));
  const file = join(dir, 'check.pdf');
  writeFileSync(file, bytes);
  const args =
    password === undefined ? ['--check', file] : [`--password=${password}`, '--check', file];
  const result = spawnSync('qpdf', args, { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
