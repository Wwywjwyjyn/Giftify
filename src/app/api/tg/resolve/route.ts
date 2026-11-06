import { NextRequest } from 'next/server';
import { resolveRecipient } from '@/lib/recipient';

/**
 * resolve یوزرنیم تلگرام برای گیرندهٔ استارز/پرمیوم:
 *  - منبع اصلی: API مارکت‌اپ (همان منبعی که خرید واقعی انجام می‌شود) — نام و عکس واقعی
 *  - فال‌بک: t.me — با هشدار شفاف اگر API یوزرنیم را اکانت شخصی نشناسد
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === 'stars' ? 'stars' : 'premium';
  const info = await resolveRecipient(String(body.username || ''), kind);
  if (!info.ok) {
    return Response.json({ ok: false, detail: info.detail }, { status: 404 });
  }
  return Response.json({
    ok: true,
    username: info.username,
    name: info.name,
    photo: info.photo,
    members: info.members,
    verified: info.verified,
    warning: info.warning || null,
    note: info.note || null,
    link: `https://t.me/${info.username}`,
  });
}
