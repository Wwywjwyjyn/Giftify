'use client';

import { useState } from 'react';
import { usePurchase } from './usePurchase';
import { TonDiamond } from './ui-bits';
import { fmtTon, faNum } from '@/lib/format';

type Attr = { trait_type: string; value: string | number };

/** دکمه‌های خرید/اجاره آیتم — تراکنش واقعی با کیف پول کاربر */
export function ItemActions(props: {
  kind: 'usernames' | 'numbers' | 'gifts';
  name: string;
  image: string | null;
  address?: string;
  attrs: Attr[];
  local?: string; // id لیستینگ محلی
  priceTon?: number | null;
  currency?: string;
  rentPerDayTon?: number | null;
  minDurationSec?: number | null;
  maxDurationSec?: number | null;
  onAuction?: boolean;
}) {
  const { purchase, busy, error, success } = usePurchase();
  const [days, setDays] = useState<number>(
    props.minDurationSec ? Math.max(1, Math.round(props.minDurationSec / 86400)) : 1,
  );

  const minDays = props.minDurationSec ? Math.max(1, Math.round(props.minDurationSec / 86400)) : 1;
  const maxDays = props.maxDurationSec ? Math.max(minDays, Math.round(props.maxDurationSec / 86400)) : 30;
  const rentTotal = (props.rentPerDayTon ?? 0) * days;
  const [fee, setFee] = useState({ percent: 0, wallet: '' });

  async function loadFee() {
    if (fee.percent) return;
    try {
      const j = await fetch('/api/settings').then((r) => r.json());
      setFee({ percent: j.fee_gifts ?? j.fee_usernames ?? 0, wallet: j.fee_wallet });
    } catch { /* بی‌اهمیت */ }
  }

  async function buy() {
    await loadFee();
    if (props.local) {
      await purchase('/api/market/buy', { local_id: props.local });
    } else {
      await purchase('/api/market/buy', {
        nft_address: props.address,
        price: props.priceTon ?? 0,
        currency: props.currency || 'TON',
      });
    }
  }

  async function rent() {
    if (!props.rentPerDayTon || !props.address) return;
    await loadFee();
    await purchase('/api/rent/pay', {
      nft_address: props.address,
      duration: days * 86400,
      price_per_day: String(Math.round((props.rentPerDayTon ?? 0) * 1e9)),
    });
  }

  return (
    <div className="mt-5 space-y-3">
      {props.priceTon ? (
        <button className="btn-primary w-full py-3" onClick={buy} disabled={busy}>
          {busy ? 'در حال پردازش…' : props.onAuction ? 'ثبت پیشنهاد (پرداخت مستقیم)' : `خرید — ${fmtTon(props.priceTon)} ${props.currency || 'TON'}`}
        </button>
      ) : null}

      {props.rentPerDayTon && props.address ? (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold text-ok">اجاره این آیتم</span>
            <span className="text-muted">
              <TonDiamond className="text-ton" /> {fmtTon(props.rentPerDayTon)} / روز
            </span>
          </div>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted">
            <span>مدت: از {faNum(minDays)} تا {faNum(maxDays)} روز</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={minDays}
              max={maxDays}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full accent-[#1691C4]"
            />
            <span className="w-20 text-center text-sm font-bold">{faNum(days)} روز</span>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-panel2 px-3 py-2 text-sm">
            <span className="text-muted">مبلغ دوره اجاره</span>
            <span className="font-bold"><TonDiamond className="text-ton" /> {fmtTon(rentTotal)} TON</span>
          </div>
          <button className="btn-primary mt-3 w-full py-2.5" onClick={rent} disabled={busy}>
            {busy ? 'در حال پردازش…' : 'پرداخت و اجاره'}
          </button>
        </div>
      ) : null}

      {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-xs text-bad">{error}</div>}
      {success && <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-xs text-ok">{success}</div>}

      {props.attrs.length > 0 && (
        <div className="card mt-4 divide-y divide-line">
          {props.attrs.map((a, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-muted">{a.trait_type === 'Model' ? 'مدل' : a.trait_type === 'Backdrop' ? 'پس‌زمینه' : a.trait_type === 'Symbol' ? 'نماد' : a.trait_type}</span>
              <span className="font-bold">{String(a.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
