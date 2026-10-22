export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const base = new URL(process.env.BACKEND_URL ?? 'http://127.0.0.1:4205');
    if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Invalid BACKEND_URL');
    const response = await fetch(new URL('/api/v1/health', base), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
