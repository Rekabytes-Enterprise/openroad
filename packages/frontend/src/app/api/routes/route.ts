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
    const response = await fetch(new URL('/routes', process.env.BACKEND_URL ?? 'http://127.0.0.1:4205'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bytes,
      cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    return new Response(await response.text(), { status: response.status, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(response.status === 429 ? { 'Retry-After': '1' } : {}),
    } });
  } catch { return Response.json({ error: 'Route service is unavailable. Try again.' }, { status: 502 }); }
}
