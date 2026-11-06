import { NextRequest } from 'next/server';
import { fetchTelegramPage } from '@/lib/tgpage';

/** resolve یوزرنیم تلگرام (نام + عکس واقعی از t.me) — بدون نیاز به هیچ توکنی */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const u = String(body.username || '')
    .replace(/^https?:\/\/(www\.)?t\.me\//i, '')
    .replace(/^@/, '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '');
  if (u.length < 3) return Response.json({ ok: false, detail: 'یوزرنیم حداقل ۳ حرف است' }, { status: 400 });
  const info = await fetchTelegramPage(u);
  if (!info.exists) {
    return Response.json({ ok: false, detail: 'این یوزرنیم در تلگرام پیدا نشد' }, { status: 404 });
  }
  return Response.json({ ok: true, username: u, name: info.title, photo: info.image, members: info.members, link: info.link });
}
