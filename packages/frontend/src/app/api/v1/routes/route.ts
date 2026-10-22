import { parseRoute } from '../../../../features/routing/route';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    // Stream with a hard cap even when Content-Length is missing or forged.
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: 'Expected a JSON request.' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2048) { await reader.cancel(); return Response.json({ error: 'Request is too large.' }, { status: 413 }); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const response = await fetch(new URL('/api/v1/routes', process.env.BACKEND_URL ?? 'http://127.0.0.1:4205'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bytes,
      cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    // The upstream may be a proxy error page, even with a JSON content type.
    const value: unknown = await response.json();
    const headers = { 'Cache-Control': 'no-store', ...(response.status === 429 ? { 'Retry-After': '1' } : {}) };
    if (!response.ok) {
      if (!value || typeof value !== 'object' || !('error' in value) || typeof value.error !== 'string') throw new Error('Invalid backend error');
      return Response.json({ error: response.status >= 500 ? 'Route service is unavailable. Try again.' : value.error }, { status: response.status, headers });
    }
    return Response.json(parseRoute(value), { headers });
  } catch { return Response.json({ error: 'Route service is unavailable. Try again.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } }); }
}
