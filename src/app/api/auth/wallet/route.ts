import { NextRequest } from 'next/server';
import { upsertUser, createSessionCookie } from '@/lib/auth';
import { verifyTonLogin } from '@/lib/tonverify';

/** ورود با کیف پول TON — فقط با ton_proof معتبر (بدون proof ورود انجام نمی‌شود) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = String(body.address || '').trim();
    if (!address || address.length < 40) return Response.json({ detail: 'آدرس نامعتبر' }, { status: 400 });

    const hosts = [
      req.headers.get('x-forwarded-host') || '',
      req.headers.get('host') || '',
      req.nextUrl.host,
    ];
    const r = verifyTonLogin(
      {
        address,
        publicKey: String(body.publicKey || ''),
        walletStateInit: String(body.walletStateInit || ''),
        proof: body.proof,
      },
      hosts,
    );
    if (!r.ok) return Response.json({ detail: r.reason || 'تأیید کیف پول ناموفق بود' }, { status: 401 });

    const { id, role, first } = await upsertUser({ wallet: address, verified: true });
    await createSessionCookie(id, role);
    return Response.json({ ok: true, first, verified: true, user: { id, role, wallet: address } });
  } catch (e) {
    return Response.json({ detail: (e as Error).message }, { status: 500 });
  }
}
