import { NextRequest } from 'next/server';
import { upsertUser, createSessionCookie } from '@/lib/auth';
import { verifyTonProof } from '@/lib/tonverify';

/** ورود با کیف پول TON (+ تأیید ton_proof اگر آمده باشد) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = String(body.address || '').trim();
    if (!address || address.length < 40) return Response.json({ detail: 'آدرس نامعتبر' }, { status: 400 });

    let verified = false;
    if (body.proof?.proof) {
      const r = verifyTonProof({ address, proof: body.proof.proof });
      verified = !!r.ok;
      // اگر تأیید نشد هم ورود انجام می‌شود؛ فقط پرچم verified=false ثبت می‌شود
    }

    const { id, role, first } = await upsertUser({ wallet: address, verified });
    await createSessionCookie(id, role);
    return Response.json({
      ok: true,
      first,
      verified,
      user: { id, role, wallet: address },
    });
  } catch (e) {
    return Response.json({ detail: (e as Error).message }, { status: 500 });
  }
}
