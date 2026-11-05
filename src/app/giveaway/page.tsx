'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PaymentMethod, PayCurrency } from '@/components/Purchase';
import { usePurchase } from '@/components/usePurchase';
import { TonDiamond } from '@/components/ui-bits';
import { faNum } from '@/lib/format';

type Price = { ton: number; gram: number; usd: number | null };
type StarPkg = { stars: number; boosts: number; ton: number; gram: number; usd: number | null };

function GiveawayInner() {
  const sp = useSearchParams();
  const type = (sp.get('type') || 'stars') as 'stars' | 'premium';

  const [channel, setChannel] = useState('');
  const [winners, setWinners] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [months, setMonths] = useState(12);
  const [packages, setPackages] = useState<StarPkg[]>([]);
  const [selStars, setSelStars] = useState<number>(500);
  const [pgPrices, setPgPrices] = useState<Record<'months3' | 'months6' | 'months12', Price> | null>(null);
  const [currency, setCurrency] = useState<PayCurrency>('TON');
  const [fee, setFee] = useState({ percent: 0, wallet: '' });
  const { purchase, busy, error, success } = usePurchase();

  useEffect(() => {
    if (type === 'stars') {
      fetch('/api/fragment/stars-giveaway/price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((r) => r.json())
        .then((j) => {
          if (j.items) {
            setPackages(j.items);
            if (j.items[0]) setSelStars(j.items[0].stars);
          }
        })
        .catch(() => {});
    } else {
      fetch('/api/fragment/premium-giveaway/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      })
        .then((r) => r.json())
        .then((j) => (j.months3 ? setPgPrices(j) : null))
        .catch(() => {});
    }
    fetch('/api/settings').then((r) => r.json()).then((j) => setFee({ percent: j.fee_giveaway ?? 0, wallet: j.fee_wallet })).catch(() => {});
  }, [type]);

  const pkg = packages.find((p) => p.stars === selStars) || null;
  const pgPrice: Price | null = pgPrices ? pgPrices[`months${months}` as 'months3' | 'months6' | 'months12'] : null;
  const amountTon = type === 'stars' ? (currency === 'GRAM' ? pkg?.gram ?? 0 : pkg?.ton ?? 0) : currency === 'GRAM' ? pgPrice?.gram ?? 0 : pgPrice?.ton ?? 0;
  const qty = type === 'stars' ? winners : quantity;
  const totalTon = amountTon * qty;
  const feeTon = fee.percent > 0 ? (totalTon * fee.percent) / 100 : 0;

  async function buy() {
    if (!channel.trim()) return alert('اول کانال را وارد کنید');
    if (type === 'stars') {
      await purchase(
        '/api/fragment/stars-giveaway/buy',
        { username: channel.replace(/^@|https:\/\/t\.me\//g, ''), quantity: winners, stars: selStars, currency },
        feeTon > 0 && fee.wallet ? `کارمزد سایت: ${feeTon.toFixed(4)} TON (${fee.percent}٪)` : undefined,
      );
    } else {
      await purchase(
        '/api/fragment/premium-giveaway/buy',
        { username: channel.replace(/^@|https:\/\/t\.me\//g, ''), months, quantity, currency },
        feeTon > 0 && fee.wallet ? `کارمزد سایت: ${feeTon.toFixed(4)} TON (${fee.percent}٪)` : undefined,
      );
    }
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="hero-title">{type === 'stars' ? 'پیش‌پرداخت گیوِی استارز' : 'پیش‌پرداخت گیوِی پرمیوم'}</h1>
      <p className="hero-sub mt-2">
        کانال تلگرام خود را بوست کنید — با هدیه‌دادن {type === 'stars' ? 'استارز' : 'اشتراک پرمیوم'} به مشترکان، گیوِی برگزار کنید.
      </p>

      <div className="mt-8 space-y-6">
        <div className="card p-5">
          <label className="mb-2 block text-sm font-bold">انتخاب کانال</label>
          <input
            className="input"
            dir="ltr"
            placeholder="@channel یا لینک t.me/…"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            autoComplete="off"
          />
        </div>

        {type === 'stars' ? (
          <>
            <div className="card p-5">
              <label className="mb-2 block text-sm font-bold">تعداد برنده‌ها (۱ تا ۵)</label>
              <input
                className="input"
                inputMode="numeric"
                value={winners}
                onChange={(e) => setWinners(Math.min(5, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))}
              />
            </div>
            <div className="card p-5">
              <label className="mb-2 block text-sm font-bold">انتخاب بسته استارز</label>
              <div className="space-y-2">
                {packages.map((p) => (
                  <label key={p.stars} className={`pkg ${selStars === p.stars ? 'checked' : ''}`}>
                    <input type="radio" name="spkg" checked={selStars === p.stars} onChange={() => setSelStars(p.stars)} />
                    <span className="flex-1 font-bold">⭐ {faNum(p.stars.toLocaleString('en-US'))} استارز</span>
                    <span className="text-xs text-muted">بوست: {faNum(p.boosts)}</span>
                    <span className="whitespace-nowrap font-bold">
                      <TonDiamond className="text-ton" /> {p.ton.toFixed(4)}
                    </span>
                  </label>
                ))}
                {packages.length === 0 && <div className="py-3 text-center text-xs text-muted">در حال دریافت بسته‌ها…</div>}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="card p-5">
              <label className="mb-2 block text-sm font-bold">تعداد اشتراک‌ها (۱ تا ۲۴۰۰۰)</label>
              <input
                className="input"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(Math.min(24000, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))}
              />
            </div>
            <div className="card p-5">
              <label className="mb-2 block text-sm font-bold">انتخاب مدت اشتراک</label>
              <div className="space-y-2">
                {[3, 6, 12].map((m) => {
                  const p = pgPrices ? pgPrices[`months${m}` as 'months3' | 'months6' | 'months12'] : null;
                  return (
                    <label key={m} className={`pkg ${months === m ? 'checked' : ''}`}>
                      <input type="radio" name="gdur" checked={months === m} onChange={() => setMonths(m)} />
                      <span className="flex-1 font-bold">{m === 12 ? '۱ ساله' : `${faNum(m)} ماهه`}</span>
                      <span className="whitespace-nowrap font-bold">
                        <TonDiamond className="text-ton" /> {p ? p.ton.toFixed(4) : '…'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="card p-5">
          <label className="mb-2 block text-sm font-bold">روش پرداخت</label>
          <PaymentMethod value={currency} onChange={setCurrency} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-4 py-3">
          <span className="text-sm text-muted">مبلغ کل (×{faNum(qty)})</span>
          <span className="font-bold">
            <TonDiamond className="text-ton" /> {totalTon.toFixed(4)} TON
          </span>
        </div>

        {fee.percent > 0 && (
          <div className="rounded-lg border border-line bg-panel2 px-4 py-3 text-xs leading-6 text-muted">
            کارمزد خدمات {faNum(fee.percent)}٪ — مبلغ {feeTon > 0 ? `${feeTon.toFixed(4)} TON` : '—'} به‌صورت شفاف به کیف پول سایت پرداخت می‌شود.
          </div>
        )}

        {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-xs text-bad">{error}</div>}
        {success && <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-xs text-ok">{success}</div>}

        <button className="btn-primary w-full py-3.5" onClick={buy} disabled={busy || (type === 'stars' ? !pkg : !pgPrice)}>
          {busy ? 'در حال پردازش…' : type === 'stars' ? `خرید استارز برای گیوِی` : 'خرید اشتراک‌ها'}
        </button>

        <div className="flex justify-center gap-4 text-xs">
          <Link href="/giveaway?type=stars" className={`hover:underline ${type === 'stars' ? 'text-accent-hi' : 'text-muted'}`}>گیوِی استارز</Link>
          <Link href="/giveaway?type=premium" className={`hover:underline ${type === 'premium' ? 'text-accent-hi' : 'text-muted'}`}>گیوِی پرمیوم</Link>
          <Link href="/my" className="text-muted hover:underline">تاریخچه تراکنش‌ها</Link>
        </div>
      </div>
    </div>
  );
}

export default function GiveawayPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <GiveawayInner />
    </Suspense>
  );
}
