/**
 * کیف پول داخلی سایت — موجودی گرام (TON) کاربر با دفتر تراکنش کامل.
 *  واریز  → کاربر به «کیف واریز» ادمین با کد یادمان خودش می‌فرستد (تشخیص خودکار از زنجیره)
 *  هزینه  → خرید/اجاره/استارز/پرمیوم از موجودی
 *  کارمزد → درصد هر بخش، جدا و شفاف در FeeRecord
 */
import { db } from './db';
import { getSettings } from './settings';
import { getAccountTransactions, txInComment, txInValueNano, txInSender } from './tonapi';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون کاراکتر‌های گیج‌کننده

function randomCode(len = 6): string {
  let s = '';
  const arr = new Uint8Array(len);
  globalThis.crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) s += ALPHA[arr[i] % ALPHA.length];
  return s;
}

export type WalletInfo = { balanceTon: number; memoCode: string };

/** حساب کیف پول کاربر را می‌گیرد؛ نبود را می‌سازد (کد یادمان یکتا) */
export async function ensureWalletAccount(userId: number): Promise<WalletInfo> {
  for (let i = 0; i < 5; i++) {
    const existing = await db.walletAccount.findUnique({ where: { userId } });
    if (existing) return { balanceTon: existing.balanceTon, memoCode: existing.memoCode };
    try {
      const created = await db.walletAccount.create({
        data: { userId, memoCode: `GFT-${randomCode(5)}` },
      });
      return { balanceTon: created.balanceTon, memoCode: created.memoCode };
    } catch {
      /* خطای یکتایی کد — دوباره تلاش */
    }
  }
  const w = await db.walletAccount.findUnique({ where: { userId } });
  if (!w) throw new Error('ساخت کیف پول ناموفق بود');
  return { balanceTon: w.balanceTon, memoCode: w.memoCode };
}

/** کارمزد یک مبلغ با گرد کردن درست در مقیاس نانو (رفع باگ واریز کارمزد) */
export function calcFee(amountTon: number, percent: number): number {
  if (!Number.isFinite(amountTon) || !Number.isFinite(percent) || percent <= 0) return 0;
  const nano = Math.round((amountTon * percent) / 100 * 1e9);
  return nano / 1e9;
}

type LedgerOpts = { orderId?: string | null; note?: string; txHash?: string | null };

/** افزودن به موجودی + ثبت در دفتر */
export async function creditBalance(
  userId: number,
  amountTon: number,
  type: 'DEPOSIT' | 'CREDIT' | 'REFUND' | 'RELEASE',
  opts: LedgerOpts = {},
): Promise<number> {
  if (!(amountTon > 0)) return -1;
  await ensureWalletAccount(userId);
  return db.$transaction(async (tx) => {
    const acc = await tx.walletAccount.update({
      where: { userId },
      data: { balanceTon: { increment: amountTon } },
    });
    await tx.walletTx.create({
      data: {
        userId,
        type,
        amountTon,
        balanceAfter: acc.balanceTon,
        orderId: opts.orderId || null,
        note: opts.note || '',
        txHash: opts.txHash || null,
      },
    });
    return acc.balanceTon;
  });
}

/** کسر از موجودی — اگر کافی نباشد null برمی‌گرداند */
export async function spendBalance(
  userId: number,
  amountTon: number,
  note: string,
  orderId?: string | null,
): Promise<number | null> {
  if (!(amountTon > 0)) return null;
  await ensureWalletAccount(userId);
  try {
    return await db.$transaction(async (tx) => {
      const acc = await tx.walletAccount.findUnique({ where: { userId } });
      if (!acc || acc.balanceTon + 1e-9 < amountTon) return null;
      const updated = await tx.walletAccount.update({
        where: { userId },
        data: { balanceTon: { decrement: amountTon } },
      });
      await tx.walletTx.create({
        data: { userId, type: 'SPEND', amountTon, balanceAfter: updated.balanceTon, orderId: orderId || null, note },
      });
      return updated.balanceTon;
    });
  } catch {
    return null;
  }
}

export type DepositMatch = { txHash: string; amountTon: number; time: number };

/**
 * بررسی واریزها از زنجیره — تراکنش‌های ورودی به کیف واریز ادمین که
 * کد یادمان کاربر در کامنت است یا از کیف پول خود کاربر آمده‌اند.
 * ضد دوبار‌شماری با txHash یکتا.
 */
export async function checkDeposits(userId: number): Promise<{ credited: DepositMatch[]; error?: string }> {
  const s = await getSettings();
  if (!s.deposit_wallet) return { credited: [], error: 'کیف واریز هنوز در پنل مدیریت تنظیم نشده است' };
  const acc = await ensureWalletAccount(userId);
  const user = await db.user.findUnique({ where: { id: userId } });
  const memo = acc.memoCode;
  const memoBare = memo.replace(/^GFT-/, '');
  const userWallet = (user?.wallet || '').toLowerCase();

  const txs = await getAccountTransactions(s.deposit_wallet, 25);
  if (txs === null) return { credited: [], error: 'بررسی زنجیره موقتاً در دسترس نیست — چند لحظه بعد دوباره تلاش کنید' };

  const credited: DepositMatch[] = [];
  for (const tx of txs) {
    const valueNano = txInValueNano(tx);
    const amountTon = Number(valueNano) / 1e9;
    if (!(amountTon > 0)) continue;
    const comment = txInComment(tx).trim();
    const sender = txInSender(tx).toLowerCase();
    const memoHit = comment.includes(memo) || (memoBare.length >= 4 && comment.includes(memoBare));
    const senderHit = userWallet && sender && sender === userWallet;
    if (!memoHit && !senderHit) continue;

    const txHash = tx.hash || `${tx.utime}-${valueNano}-${sender}`;
    try {
      // دفتر با txHash یکتا — واریز تکراری هرگز دوبار حساب نمی‌شود
      const dup = await db.walletTx.findUnique({ where: { txHash } });
      if (dup) continue;
      await creditBalance(userId, amountTon, 'DEPOSIT', {
        txHash,
        note: `واریز به ${s.site_name}${memoHit ? ` با کد ${memo}` : ''}`,
      });
      credited.push({ txHash, amountTon, time: tx.utime });
    } catch {
      /* تکراری — رد شود */
    }
  }
  return { credited };
}

/** موجودی + چند تراکنش آخر برای نمایش */
export async function walletOverview(userId: number) {
  const acc = await ensureWalletAccount(userId);
  const txs = await db.walletTx.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return { balanceTon: acc.balanceTon, memoCode: acc.memoCode, txs };
}
