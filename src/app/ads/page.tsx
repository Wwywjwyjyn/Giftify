'use client';

import { useEffect, useState } from 'react';
import { PaymentMethod, PayCurrency } from '@/components/Purchase';
import { usePurchase } from '@/components/usePurchase';
import { faNum } from '@/lib/format';

/** شارژ حساب تبلیغات فرگمنت (Ads) — مثل تب Ads فرگمنت */
export default function AdsPage() {
  const [link, setLink] = useState('');
  const [amount, setAmount] = useState(100);
  const [currency, setCurrency] = useState<PayCurrency>('TON');
  const [fee, setFee] = useState({ percent: 0, wallet: '' });
  const { purchase, busy, error, success } = usePurchase();

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((j) => setFee({ percent: j.fee_ads ?? 0, wallet: j.fee_wallet })).catch(() => {});
  }, []);

  const feeTon = fee.percent > 0 ? (amount * fee.percent) / 100 : 0;

  async function buy() {
    if (!link.trim()) return alert('لینک کمپین تبلیغاتی را وارد کنید');
    await purchase(
      '/api/fragment/ads/topup',
      { fragment_link: link.trim(), amount, currency },
      feeTon > 0 && fee.wallet ? `کارمزد سایت: ${feeTon.toFixed(4)} TON (${fee.percent}٪)` : undefined,
    );
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="hero-title">تبلیغات تلگرام</h1>
      <p className="hero-sub mt-2">
        حساب تبلیغاتی فرگمنت خود را شارژ کنید. لینک کمپین تبلیغاتی را از بخش Ads فرگمنت کپی کنید و اینجا مبلغ را شارژ کنید.
      </p>

      <div className="mt-8 space-y-6">
        <div className="card p-5">
          <label className="mb-2 block text-sm font-bold">لینک کمپین تبلیغاتی فرگمنت</label>
          <input
            className="input"
            dir="ltr"
            placeholder="https://fragment.com/ads/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            autoComplete="off"
          />
          <p className="mt-2 text-xs text-muted">
            در فرگمنت وارد Ads شوید، کمپین جدید بسازید و لینک پرداخت آن را اینجا قرار دهید.
          </p>
        </div>

        <div className="card p-5">
          <label className="mb-2 block text-sm font-bold">مبلغ شارژ (TON)</label>
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
          />
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

        <button className="btn-primary w-full py-3.5" onClick={buy} disabled={busy}>
          {busy ? 'در حال پردازش…' : 'شارژ حساب تبلیغات'}
        </button>
      </div>
    </div>
  );
}
