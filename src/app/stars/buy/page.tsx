'use client';

import { Suspense, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { RecipientSearch } from '@/components/Purchase';
import { usePurchase } from '@/components/usePurchase';
import { refreshWalletBadge } from '@/components/WalletBox';
import { TonDiamond } from '@/components/ui-bits';
import { faNum, fmtTon } from '@/lib/format';

const PACKAGES = [50, 100, 350, 500, 1000, 2500, 5000, 15000, 50000, 100000];

function StarsBuyInner() {
  const sp = useSearchParams();
  const [qty, setQty] = useState<number>(Number(sp.get('qty')) || 50);
  const [custom, setCustom] = useState('');
  const [priceTon, setPriceTon] = useState<number | null>(null);
  const [priceSource, setPriceSource] = useState<string>('');
  const [username, setUsername] = useState('');
  const [fee, setFee] = useState({ percent: 0, wallet: '' });
  const { purchase, busy, error, success } = usePurchase();

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((j) => setFee({ percent: j.fee_stars ?? 0, wallet: j.fee_wallet })).catch(() => {});
  }, []);

  useEffect(() => {
    setPriceTon(null);
    const t = setTimeout(() => {
      fetch(`/api/price?kind=stars&qty=${qty}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.ok && j.ton > 0) {
            setPriceTon(j.ton);
            setPriceSource(j.source);
          }
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [qty]);

  const feeTon = priceTon ? Math.round(((priceTon * fee.percent) / 100) * 1e9) / 1e9 : 0;

  async function buy(payWith: 'wallet' | 'ton') {
    if (!username.trim()) return;
    const r = await purchase('/api/order', { kind: 'stars', username: username.replace(/^@/, ''), qty, pay_with: payWith });
    if (r.ok) refreshWalletBadge();
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="hero-title">خرید تلگرام استارز</h1>
      <p className="hero-sub mt-2">شارژ موجودی استارز برای خودتان یا دوستانتان — با پرداخت TON.</p>

      <div className="mt-8 space-y-6">
        <div className="card p-5">
          <RecipientSearch endpoint="/api/tg/resolve" label="انتخاب گیرنده" onFound={setUsername} />
          {username && (
            <div className="mt-2 text-[11px] text-ok">گیرنده تأیید شد ✓</div>
          )}
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
                <span className="text-muted tabular">
                  {p === qty ? priceTon ? `${fmtTon(priceTon)} TON` : '…' : ''}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 text-center">
            <button className="text-xs text-accent-hi hover:underline" onClick={() => { setCustom(''); setQty(50); }}>
              بازنشانی به بسته پیش‌فرض
            </button>
          </div>
        </div>

        {/* شفافیت کارمزد */}
        {fee.percent > 0 && (
          <div className="rounded-lg border border-line bg-panel2 px-4 py-3 text-xs leading-6 text-muted">
            کارمزد خدمات {faNum(fee.percent)}٪ — {feeTon > 0 ? `${feeTon.toFixed(4)} TON` : '—'} به‌صورت شفاف جدا از مبلغ اصلی محاسبه می‌شود.
          </div>
        )}

        {priceTon && (
          <div className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-4 py-3">
            <span className="text-sm text-muted">مبلغ قابل پرداخت</span>
            <span className="font-bold">
              <TonDiamond className="text-ton" /> {fmtTon(priceTon)} TON
            </span>
          </div>
        )}
        {priceSource === 'admin' && (
          <div className="text-center text-[11px] text-muted">قیمت بر اساس تعرفهٔ سایت محاسبه شده است.</div>
        )}

        {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-xs text-bad">{error}</div>}
        {success && (
          <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-xs leading-6 text-ok">
            {success}
            <div className="mt-2 flex gap-2">
              <a href="/inventory" className="btn-ghost btn-sm">پیگیری در انباری</a>
              <a href="/wallet" className="btn-ghost btn-sm">کیف پول من</a>
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
            <a href="/wallet" className="mx-1 text-accent-hi hover:underline">شارژ کیف پول</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StarsBuyPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <StarsBuyInner />
    </Suspense>
  );
}
