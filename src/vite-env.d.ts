/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __SOURCE_URL__: string;
/** Uncompressed size of the MuPDF WebAssembly binary, for the loading progress bar. */
declare const __MUPDF_WASM_BYTES__: number;

declare module '@mupdf-wasm?url' {
  const url: string;
  export default url;
}
