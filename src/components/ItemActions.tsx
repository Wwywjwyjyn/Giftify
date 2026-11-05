'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBasket } from 'lucide-react';
import { usePurchase } from './usePurchase';
import { TonDiamond } from './ui-bits';
import { fmtTon, faNum } from '@/lib/format';
import { useCart } from './CartProvider';

type Attr = { trait_type: string; value: string | number };

/**
 * اکشن‌های آیتم:
 *  - اجاره کردن: پنل انتخاب مدت + پرداخت واقعی با TON Connect (endpoint رایگان مارکت‌اپ)
 *  - خرید: فقط برای لیستینگ‌های سایت (پرداخت مستقیم به فروشنده + کارمزد شفاف)
 *  - سبد خرید: افزودن خریدِ لیستینگ سایت
 */
export function ItemActions(props: {
  kind: 'usernames' | 'numbers' | 'gifts';
  name: string;
  image: string | null;
  address?: string;
  attrs: Attr[];
  local?: string;
  priceTon?: number | null;
  currency?: string;
  rentPerDayTon?: number | null;
  minDurationSec?: number | null;
  maxDurationSec?: number | null;
}) {
  const { purchase, busy, error, success } = usePurchase();
  const cart = useCart();
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
      setFee({ percent: j.fee_rent ?? j.fee_gifts ?? 0, wallet: j.fee_wallet });
    } catch { /* بی‌اهمیت */ }
  }

  async function buy() {
    if (!props.local) return;
    await loadFee();
    await purchase('/api/market/buy', { local_id: props.local });
  }

  async function rent() {
    if (!props.rentPerDayTon || !props.address || props.address.startsWith('local:')) return;
    await loadFee();
    await purchase('/api/rent/pay', {
      nft_address: props.address,
      duration: days * 86400,
      price_per_day: String(Math.round((props.rentPerDayTon ?? 0) * 1e9)),
    });
  }

  const inCart = props.local ? cart.has(`local:${props.local}`) : false;
  const isLocalRent = props.local && props.rentPerDayTon;

  return (
    <div className="mt-5 space-y-3">
      {/* پنل اجاره کردن */}
      {props.rentPerDayTon ? (
        <div className="card p-4" id="rent">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold text-ok">اجاره کردن این آیتم</span>
            <span className="text-muted tabular">
              <TonDiamond className="text-ton" /> {fmtTon(props.rentPerDayTon)} / روز
            </span>
          </div>
          {isLocalRent && (
            <div className="mb-2 text-[11px] leading-5 text-muted">
              اجارهٔ لیستینگ این سایت — پس از پرداخت، از طریق پشتیبانی سایت فعال می‌شود.
            </div>
          )}
          <div className="mb-2 text-xs text-muted">
            مدت: از {faNum(minDays)} تا {faNum(maxDays)} روز
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={minDays}
              max={maxDays}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full accent-[#1691C4]"
              aria-label="مدت اجاره"
            />
            <span className="w-16 text-center text-sm font-bold tabular">{faNum(days)} روز</span>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-panel2 px-3 py-2 text-sm">
            <span className="text-muted">مبلغ دورهٔ اجاره</span>
            <span className="font-bold tabular"><TonDiamond className="text-ton" /> {fmtTon(rentTotal)} TON</span>
          </div>
          {fee.percent > 0 && (
            <div className="mt-1.5 text-[11px] text-muted">
              کارمزد سایت: {faNum(fee.percent)}٪ — شفاف و جدا از مبلغ اجاره ثبت می‌شود
            </div>
          )}
          {!props.local && (
            <button className="btn-rent mt-3 w-full py-2.5" onClick={rent} disabled={busy}>
              {busy ? 'در حال پردازش…' : `پرداخت و اجاره — ${fmtTon(rentTotal)} TON`}
            </button>
          )}
          {props.local && (
            <button className="btn-rent mt-3 w-full py-2.5" onClick={rent} disabled={busy} title="اجارهٔ لیستینگ محلی پس از پرداخت تایید می‌شود">
              {busy ? 'در حال پردازش…' : 'درخواست اجاره'}
            </button>
          )}
        </div>
      ) : null}

      {/* خرید — فقط لیستینگ سایت */}
      {props.local && props.priceTon ? (
        <div className="space-y-2">
          <button className="btn-primary w-full py-3" onClick={buy} disabled={busy}>
            {busy ? 'در حال پردازش…' : `خرید — ${fmtTon(props.priceTon)} ${props.currency || 'TON'}`}
          </button>
          <button
            className="btn-ghost w-full py-2.5"
            onClick={() =>
              cart.add({
                id: `local:${props.local}`,
                source: 'local',
                localId: props.local,
                kind: props.kind,
                name: props.name,
                image: props.image,
                priceTon: props.priceTon ?? 0,
                attrs: props.attrs,
              })
            }
            disabled={inCart}
          >
            <ShoppingBasket size={16} /> {inCart ? 'در سبد خرید هست ✓' : 'افزودن به سبد خرید'}
          </button>
        </div>
      ) : null}

      {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-xs leading-6 text-bad">{error}</div>}
      {success && (
        <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-xs leading-6 text-ok">
          {success}
          <div className="mt-2 flex gap-2">
            <Link href="/inventory" className="btn-ghost btn-sm">مشاهده انباری</Link>
          </div>
        </div>
      )}

      {/* ویژگی‌ها — نظم فرگمنت */}
      {props.attrs.length > 0 && (
        <div className="card mt-4 divide-y divide-line">
          {props.attrs.map((a, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-muted">
                {a.trait_type === 'Model' ? 'مدل' : a.trait_type === 'Backdrop' ? 'پس‌زمینه' : a.trait_type === 'Symbol' ? 'نماد' : a.trait_type}
              </span>
              <span className="font-bold">{String(a.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
