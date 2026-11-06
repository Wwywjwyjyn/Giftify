'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RecipientSearch } from '@/components/Purchase';
import { usePurchase } from '@/components/usePurchase';
import { refreshWalletBadge } from '@/components/WalletBox';
import { TonDiamond } from '@/components/ui-bits';
import { fmtTon, faNum } from '@/lib/format';

const DURATIONS: { months: number; label: string; badge?: string }[] = [
  { months: 12, label: '۱ ساله', badge: 'پیشنهاد ویژه' },
  { months: 6, label: '۶ ماهه' },
  { months: 3, label: '۳ ماهه' },
];

export default function PremiumPage() {
  const [prices, setPrices] = useState<Record<number, number | null>>({ 3: null, 6: null, 12: null });
  const [months, setMonths] = useState(3);
  const [username, setUsername] = useState('');
  const [fee, setFee] = useState({ percent: 0, wallet: '' });
  const { purchase, busy, error, success } = usePurchase();

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((j) => setFee({ percent: j.fee_premium ?? 0, wallet: j.fee_wallet })).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        DURATIONS.map(async (d) => {
          try {
            const j = await fetch(`/api/price?kind=premium&months=${d.months}`).then((r) => r.json());
            return [d.months, j.ok && j.ton > 0 ? j.ton : null] as const;
          } catch {
            return [d.months, null] as const;
          }
        }),
      );
      if (alive) setPrices(Object.fromEntries(entries));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const priceTon = prices[months] ?? null;
  const feeTon = priceTon ? Math.round(((priceTon * fee.percent) / 100) * 1e9) / 1e9 : 0;

  async function buy(payWith: 'wallet' | 'ton') {
    if (!username.trim()) return;
    const r = await purchase('/api/order', { kind: 'premium', username: username.replace(/^@/, ''), months, pay_with: payWith });
    if (r.ok) refreshWalletBadge();
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="hero-title">خرید تلگرام پرمیوم ⭐</h1>
      <p className="hero-sub mt-2">اشتراک پرمیوم تلگرام برای خودتان یا دوستانتان — با پرداخت TON.</p>

      <div className="mt-8 space-y-6">
        <div className="card p-5">
          <RecipientSearch endpoint="/api/tg/resolve" label="انتخاب گیرنده" onFound={setUsername} />
          {username && (
            <div className="mt-2 text-[11px] text-ok">گیرنده تأیید شد ✓</div>
          )}
        </div>

        <div className="card p-5">
          <label className="mb-2 block text-sm font-bold">انتخاب مدت اشتراک</label>
          <div className="space-y-2">
            {DURATIONS.map((d) => (
              <label key={d.months} className={`pkg ${months === d.months ? 'checked' : ''}`}>
                <input type="radio" name="dur" checked={months === d.months} onChange={() => setMonths(d.months)} />
                <span className="flex-1 font-bold">{d.label}</span>
                {d.badge && <span className="pill bg-ok/15 text-ok">{d.badge}</span>}
                <span className="whitespace-nowrap font-bold tabular">
                  <TonDiamond className="text-ton" /> {prices[d.months] ? `${fmtTon(prices[d.months]!)} TON` : '…'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {fee.percent > 0 && (
          <div className="rounded-lg border border-line bg-panel2 px-4 py-3 text-xs leading-6 text-muted">
            کارمزد خدمات {faNum(fee.percent)}٪ — {feeTon > 0 ? `${feeTon.toFixed(4)} TON` : '—'} به‌صورت شفاف جدا از مبلغ اصلی محاسبه می‌شود.
          </div>
        )}

        {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-xs text-bad">{error}</div>}
        {success && (
          <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-xs leading-6 text-ok">
            {success}
            <div className="mt-2 flex gap-2">
              <Link href="/inventory" className="btn-ghost btn-sm">پیگیری در انباری</Link>
              <Link href="/wallet" className="btn-ghost btn-sm">کیف پول من</Link>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button className="btn-primary w-full py-3.5" onClick={() => buy('wallet')} disabled={busy || !priceTon || !username}>
            {busy ? 'در حال پردازش…' : `خرید با کیف پول سایت${priceTon ? ` — ${fmtTon(priceTon)} TON` : ''}`}
          </button>
          <button className="btn-ghost w-full py-3" onClick={() => buy('ton')} disabled={busy || !priceTon || !username}>
            {busy ? 'در حال پردازش…' : 'خرید با TON Connect'}
          </button>
          <div className="text-center text-[11px] leading-5 text-muted">
            «کیف پول سایت» = موجودی گرام داخل سایت — سریع و بدون کارمزد شبکه.
            <Link href="/wallet" className="mx-1 text-accent-hi hover:underline">شارژ کیف پول</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
