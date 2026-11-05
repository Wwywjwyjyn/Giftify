import { NextRequest } from 'next/server';
import { resolveImage } from '@/lib/images';

/** ریدایرکت به عکس واقعی NFT (با کش دیتابیس) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address: raw } = await ctx.params;
  const address = decodeURIComponent(raw);
  try {
    const url = await resolveImage({ address, kind: 'gift' });
    if (url) return Response.redirect(url, 302);
  } catch { /* 404 */ }
  return new Response('not found', { status: 404 });
}
