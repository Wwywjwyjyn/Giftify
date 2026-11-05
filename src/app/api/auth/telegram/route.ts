import { NextRequest } from 'next/server';
import { upsertUser, createSessionCookie } from '@/lib/auth';
import { verifyInitData } from '@/lib/telegram';

/** ورود خودکار داخل تلگرام (Mini App) با initData امضاشده ربات */
export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    const r = verifyInitData(String(initData || ''));
    if (!r.ok || !r.user) return Response.json({ detail: r.reason || 'initData نامعتبر' }, { status: 401 });

    const { id, role, first } = await upsertUser({
      telegramId: String(r.user.id),
      name: [r.user.first_name, r.user.username ? `@${r.user.username}` : ''].filter(Boolean).join(' ') || undefined,
      photo: r.user.photo_url || undefined,
      verified: true,
    });
    await createSessionCookie(id, role);
    return Response.json({ ok: true, first, user: { id, role, telegramId: String(r.user.id), name: r.user.first_name } });
  } catch (e) {
    return Response.json({ detail: (e as Error).message }, { status: 500 });
  }
}
