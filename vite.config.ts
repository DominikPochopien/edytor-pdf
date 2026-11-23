import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import license from 'rollup-plugin-license';
import { defineConfig } from 'vitest/config';
import { resolveBasePath } from './build/basePath.ts';
import { contentSecurityPolicy } from './build/csp.ts';
import packageJson from './package.json' with { type: 'json' };

const MUPDF_WASM = fileURLToPath(
  new URL('./node_modules/mupdf/dist/mupdf-wasm.wasm', import.meta.url),
);
const NODE_BUILTIN_STUB = fileURLToPath(new URL('./build/emptyModule.ts', import.meta.url));

/** Path where the app's source code is published (AGPL-3.0 requires a visible link). */
const SOURCE_URL = process.env.SOURCE_URL ?? 'https://github.com/DominikPochopien/edytor-pdf';

export default defineConfig({
  base: resolveBasePath(process.env.BASE_PATH),
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    license({
      thirdParty: {
        includePrivate: false,
        output: {
          file: fileURLToPath(new URL('./dist/THIRD_PARTY_LICENSES.txt', import.meta.url)),
        },
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __SOURCE_URL__: JSON.stringify(SOURCE_URL),
    __MUPDF_WASM_BYTES__: JSON.stringify(statSync(MUPDF_WASM).size),
  },
  resolve: {
    alias: [
      // The WebAssembly binary is fetched by our own loader (progress bar, any base path).
      { find: /^@mupdf-wasm\?url$/, replacement: `${MUPDF_WASM}?url` },
      // mupdf.js only imports Node built-ins when running under Node.js (tests);
      // the browser bundle never needs them.
      ...(process.env.VITEST === undefined
        ? [{ find: /^(node:)?(fs|module)$/, replacement: NODE_BUILTIN_STUB }]
        : []),
    ],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // The WASM engine (~10 MB raw) is loaded on demand in a worker, never in the main bundle.
    chunkSizeWarningLimit: 700,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}', 'build/**/*.test.ts'],
          environment: 'jsdom',
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 60_000,
        },
      },
    ],
  },
});
