import "server-only";
// Bounded decoding for the new JSON-only endpoints. Existing routes are unchanged.
export async function readBoundedJson(request: Request, limit = 16_384): Promise<unknown> {
  if (request.headers.get("content-type")?.toLowerCase().split(";")[0].trim() !== "application/json" || !request.body) return undefined;
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];let size = 0;
  try {
    while (true) { const { value, done } = await reader.read();if (done) break;size += value.byteLength;if (size > limit) { await reader.cancel();return undefined; }chunks.push(value); }
    const bytes = new Uint8Array(size);let offset = 0;for (const chunk of chunks) { bytes.set(chunk, offset);offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return undefined; } finally { reader.releaseLock(); }
}
