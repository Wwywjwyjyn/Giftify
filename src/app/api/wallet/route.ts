import { getSessionUser } from '@/lib/auth';
import { walletOverview, checkDeposits } from '@/lib/wallet';
import { getSettings } from '@/lib/settings';
import { safeDetail } from '@/lib/errors';

/** وضعیت کیف پول داخلی: موجودی، کد یادمان واریز، تراکنش‌ها */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ user: null, wallet: null }, { status: 200 });
  try {
    const w = await walletOverview(user.id);
    const s = await getSettings();
    return Response.json({
      user: { id: user.id, role: user.role, wallet: user.wallet },
      wallet: {
        balanceTon: w.balanceTon,
        memoCode: w.memoCode,
        depositWallet: s.deposit_wallet || null,
        txs: w.txs.map((t) => ({
          id: t.id, type: t.type, amountTon: t.amountTon, balanceAfter: t.balanceAfter,
          note: t.note, createdAt: t.createdAt,
        })),
      },
    });
  } catch (e) {
    return Response.json({ detail: safeDetail((e as Error).message) }, { status: 500 });
  }
}

/** بررسی واریزهای جدید از زنجیره — خودکار موجودی را شارژ می‌کند */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, detail: 'اول وارد شوید' }, { status: 401 });
  try {
    const r = await checkDeposits(user.id);
    const w = await walletOverview(user.id);
    return Response.json({
      ok: true,
      credited: r.credited,
      error: r.error || null,
      balanceTon: w.balanceTon,
    });
  } catch (e) {
    return Response.json({ ok: false, detail: safeDetail((e as Error).message) }, { status: 500 });
  }
}
