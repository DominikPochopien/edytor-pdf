/**
 * Downloads a file and reports progress. `expectedBytes` is the uncompressed size known at build
 * time: Content-Length cannot be trusted when the server compresses the response.
 */
export async function fetchWithProgress(
  url: string,
  expectedBytes: number,
  onProgress: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    received += value.byteLength;
    onProgress(Math.min(1, received / expectedBytes));
  }
  const result = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(1);
  return result.buffer;
}
