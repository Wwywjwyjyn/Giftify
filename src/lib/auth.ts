import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';
import { env } from './env';

export type Session = { uid: number; role: 'ADMIN' | 'USER' };

const COOKIE = 'giftify_session';
const MAX_AGE = 60 * 60 * 24 * 30; // ۳۰ روز

function secretKey(): Uint8Array {
  const s = env.jwtSecret || 'giftify-dev-secret-change-me';
  return new TextEncoder().encode(s);
}

export async function createSessionCookie(uid: number, role: 'ADMIN' | 'USER') {
  const token = await new SignJWT({ uid, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.uid !== 'number') return null;
    return { uid: payload.uid, role: (payload.role as 'ADMIN' | 'USER') || 'USER' };
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const s = await getSession();
  if (!s) return null;
  try {
    const user = await db.user.findUnique({ where: { id: s.uid } });
    return user;
  } catch {
    return null;
  }
}

export async function requireAdminJson(): Promise<Response | null> {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') {
    return Response.json({ detail: 'دسترسی فقط برای مدیر سایت' }, { status: 403 });
  }
  return null;
}

/**
 * اولین کاربرِ تأییدشده (کیف پول با ton_proof یا تلگرام با initData معتبر) = مدیر سایت.
 * اگر هیچ کاربری نباشد، این کاربر با نقش ADMIN ساخته می‌شود.
 */
export async function upsertUser(
  identity: { wallet?: string; telegramId?: string; name?: string; photo?: string; verified: boolean },
): Promise<{ id: number; role: 'ADMIN' | 'USER'; first: boolean }> {
  const where = identity.wallet ? { wallet: identity.wallet } : { telegramId: identity.telegramId! };
  const existing = await db.user.findFirst({ where });
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        name: identity.name ?? existing.name,
        photo: identity.photo ?? existing.photo,
        lastSeen: new Date(),
        wallet: identity.wallet ?? existing.wallet,
        telegramId: identity.telegramId ?? existing.telegramId,
      },
    });
    return { id: existing.id, role: (existing.role as 'ADMIN' | 'USER') || 'USER', first: false };
  }
  const count = await db.user.count();
  const role: 'ADMIN' | 'USER' = count === 0 && identity.verified ? 'ADMIN' : 'USER';
  const user = await db.user.create({
    data: {
      wallet: identity.wallet ?? null,
      telegramId: identity.telegramId ?? null,
      name: identity.name ?? null,
      photo: identity.photo ?? null,
      role,
      verified: identity.verified,
    },
  });
  return { id: user.id, role, first: count === 0 };
}
