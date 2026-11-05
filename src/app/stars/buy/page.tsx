'use client';

import { Suspense, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { PaymentMethod, RecipientSearch, PayCurrency } from '@/components/Purchase';
import { usePurchase } from '@/components/usePurchase';
import { TonDiamond } from '@/components/ui-bits';
import { faNum } from '@/lib/format';

const PACKAGES = [50, 100, 350, 500, 1000, 2500, 5000, 15000, 50000, 100000];

function StarsBuyInner() {
  const sp = useSearchParams();
  const [qty, setQty] = useState<number>(Number(sp.get('qty')) || 50);
  const [custom, setCustom] = useState('');
  const [price, setPrice] = useState<{ ton: number; gram: number; usd: number | null } | null>(null);
  const [currency, setCurrency] = useState<PayCurrency>('TON');
  const [username, setUsername] = useState('');
  const [fee, setFee] = useState<{ percent: number; wallet: string }>({ percent: 0, wallet: '' });
  const { purchase, busy, error, success } = usePurchase();

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((j) => setFee({ percent: j.fee_stars ?? 0, wallet: j.fee_wallet })).catch(() => {});
  }, []);

  useEffect(() => {
    setPrice(null);
    const t = setTimeout(() => {
      fetch('/api/fragment/stars/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      })
        .then((r) => r.json())
        .then((j) => (j.ton !== undefined ? setPrice(j) : null))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [qty]);

  const amountTon = currency === 'TON' ? price?.ton ?? 0 : currency === 'GRAM' ? price?.gram ?? 0 : price?.ton ?? 0;
  const feeTon = fee.percent > 0 ? (amountTon * fee.percent) / 100 : 0;

  async function buy() {
    if (!username.trim()) return alert('اول گیرنده را انتخاب کنید');
    await purchase(
      '/api/fragment/stars/buy',
      { username: username.replace(/^@/, ''), quantity: qty, currency },
      feeTon > 0 && fee.wallet
        ? `کارمزد سایت: ${feeTon.toFixed(4)} TON (${fee.percent}٪) — پس از تراکنش اصلی، به کیف پول سایت پرداخت می‌شود`
        : undefined,
    );
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="hero-title">خرید تلگرام استارز</h1>
      <p className="hero-sub mt-2">شارژ موجودی استارز برای خودتان یا دوستانتان — قیمت لحظه‌ای از فرگمنت.</p>

      <div className="mt-8 space-y-6">
        <div className="card p-5">
          <RecipientSearch endpoint="/api/fragment/stars/recipient" label="انتخاب گیرنده" onFound={(u) => setUsername(u)} />
        </div>

        <div className="card p-5">
          <label className="mb-2 block text-sm font-bold">مقدار استارز (۵۰ تا ۱۰,۰۰۰,۰۰۰)</label>
          <div className="relative">
            <Star size={16} className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[#FBBF24]" />
            <input
              className="input pe-11"
              inputMode="numeric"
              placeholder="مقدار دلخواه استارز…"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                const n = Number(e.target.value.replace(/\D/g, ''));
                if (n >= 50 && n <= 10000000) setQty(n);
              }}
            />
          </div>

          <div className="mt-5 mb-2 text-sm font-bold">یا انتخاب از بسته‌ها</div>
          <div className="space-y-2">
            {PACKAGES.map((p) => (
              <label key={p} className={`pkg ${qty === p && !custom ? 'checked' : ''}`}>
                <input
                  type="radio"
                  name="pkg"
                  checked={qty === p && !custom}
                  onChange={() => {
                    setCustom('');
                    setQty(p);
                  }}
                />
                <span className="flex-1 font-bold">
                  ⭐ {faNum(p.toLocaleString('en-US'))} استارز
                </span>
                <span className="text-muted">{p === qty ? price ? fmtPrice(price, currency) : '…' : ''}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 text-center">
            <button className="text-xs text-accent-hi hover:underline" onClick={() => { setCustom(''); setQty(50); }}>
              بازنشانی به بسته پیش‌فرض
            </button>
          </div>
        </div>

        <div className="card p-5">
          <label className="mb-2 block text-sm font-bold">روش پرداخت</label>
          <PaymentMethod value={currency} onChange={setCurrency} />
        </div>

        {/* شفافیت کارمزد */}
        {fee.percent > 0 && (
          <div className="rounded-lg border border-line bg-panel2 px-4 py-3 text-xs leading-6 text-muted">
            کارمزد خدمات {fee.percent}٪ — مبلغ {feeTon > 0 ? `${feeTon.toFixed(4)} TON` : '—'} که پس از تراکنش اصلی، به کیف پول سایت پرداخت می‌شود.
          </div>
        )}

        {price && (
          <div className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-4 py-3">
            <span className="text-sm text-muted">مبلغ قابل پرداخت</span>
            <span className="font-bold">
              <TonDiamond className="text-ton" /> {fmtPrice(price, currency)}
            </span>
          </div>
        )}

        {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-xs text-bad">{error}</div>}
        {success && <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-xs text-ok">{success}</div>}

        <button className="btn-primary w-full py-3.5" onClick={buy} disabled={busy || !price}>
          {busy ? 'در حال پردازش…' : `خرید ${faNum(qty.toLocaleString('en-US'))} استارز`}
        </button>
      </div>
    </div>
  );
}

function fmtPrice(price: { ton: number; gram: number; usd: number | null }, currency: PayCurrency): string {
  if (currency === 'USDT') return price.usd !== null ? `$${price.usd.toFixed(2)}` : '—';
  if (currency === 'GRAM') return `${price.gram.toFixed(4)} GRAM`;
  return `${price.ton.toFixed(4)} TON`;
}

export default function StarsBuyPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <StarsBuyInner />
    </Suspense>
  );
}
