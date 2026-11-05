'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PaymentMethod, RecipientSearch, PayCurrency } from '@/components/Purchase';
import { usePurchase } from '@/components/usePurchase';
import { TonDiamond } from '@/components/ui-bits';
import { faNum } from '@/lib/format';

type Price = { ton: number; gram: number; usd: number | null };

const DURATIONS: { months: number; label: string; badge?: string }[] = [
  { months: 12, label: '۱ ساله', badge: 'پیشنهاد ویژه' },
  { months: 6, label: '۶ ماهه' },
  { months: 3, label: '۳ ماهه' },
];

export default function PremiumPage() {
  const [prices, setPrices] = useState<Record<'months3' | 'months6' | 'months12', Price> | null>(null);
  const [months, setMonths] = useState(12);
  const [currency, setCurrency] = useState<PayCurrency>('TON');
  const [username, setUsername] = useState('');
  const [fee, setFee] = useState({ percent: 0, wallet: '' });
  const { purchase, busy, error, success } = usePurchase();

  useEffect(() => {
    fetch('/api/fragment/premium/price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => r.json())
      .then((j) => (j.months3 ? setPrices(j) : null))
      .catch(() => {});
    fetch('/api/settings').then((r) => r.json()).then((j) => setFee({ percent: j.fee_premium ?? 0, wallet: j.fee_wallet })).catch(() => {});
  }, []);

  const price: Price | null = prices ? prices[`months${months}` as 'months3' | 'months6' | 'months12'] : null;
  const amountTon = currency === 'TON' ? price?.ton ?? 0 : currency === 'GRAM' ? price?.gram ?? 0 : price?.ton ?? 0;
  const feeTon = fee.percent > 0 ? (amountTon * fee.percent) / 100 : 0;

  function fmt(price: Price | null): string {
    if (!price) return '…';
    if (currency === 'USDT') return price.usd !== null ? `$${price.usd.toFixed(2)}` : '—';
    if (currency === 'GRAM') return `${price.gram.toFixed(4)} GRAM`;
    return `${price.ton.toFixed(4)} TON`;
  }

  async function buy() {
    if (!username.trim()) return alert('اول گیرنده را انتخاب کنید');
    await purchase(
      '/api/fragment/premium/buy',
      { username: username.replace(/^@/, ''), months, currency },
      feeTon > 0 && fee.wallet ? `کارمزد سایت: ${feeTon.toFixed(4)} TON (${fee.percent}٪) — پس از تراکنش اصلی پرداخت می‌شود` : undefined,
    );
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="hero-title">خرید تلگرام پرمیوم ⭐</h1>
      <p className="hero-sub mt-2">با کیف پول کریپتوی خود، اشتراک پرمیوم تلگرام را برای خودتان یا دوستانتان بخرید.</p>

      <div className="mt-8 space-y-6">
        <div className="card p-5">
          <RecipientSearch endpoint="/api/fragment/premium/recipient" label="انتخاب گیرنده" onFound={setUsername} />
        </div>

        <div className="card p-5">
          <label className="mb-2 block text-sm font-bold">انتخاب مدت اشتراک</label>
          <div className="space-y-2">
            {DURATIONS.map((d) => {
              const p = prices ? prices[`months${d.months}` as 'months3' | 'months6' | 'months12'] : null;
              return (
                <label key={d.months} className={`pkg ${months === d.months ? 'checked' : ''}`}>
                  <input type="radio" name="dur" checked={months === d.months} onChange={() => setMonths(d.months)} />
                  <span className="flex-1 font-bold">{d.label}</span>
                  {d.badge && <span className="pill bg-ok/15 text-ok">{d.badge}</span>}
                  <span className="whitespace-nowrap font-bold">
                    <TonDiamond className="text-ton" /> {fmt(p)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <label className="mb-2 block text-sm font-bold">روش پرداخت</label>
          <PaymentMethod value={currency} onChange={setCurrency} />
        </div>

        {fee.percent > 0 && (
          <div className="rounded-lg border border-line bg-panel2 px-4 py-3 text-xs leading-6 text-muted">
            کارمزد خدمات {faNum(fee.percent)}٪ — مبلغ {feeTon > 0 ? `${feeTon.toFixed(4)} TON` : '—'} به‌صورت شفاف به کیف پول سایت پرداخت می‌شود.
          </div>
        )}

        {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-xs text-bad">{error}</div>}
        {success && <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-xs text-ok">{success}</div>}

        <button className="btn-primary w-full py-3.5" onClick={buy} disabled={busy || !price}>
          {busy ? 'در حال پردازش…' : 'هدیه تلگرام پرمیوم'}
        </button>

        <div className="text-center">
          <Link href="/my" className="text-xs text-accent-hi hover:underline">مشاهده تاریخچه تراکنش‌ها</Link>
        </div>
      </div>
    </div>
  );
}
