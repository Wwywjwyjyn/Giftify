'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBasket, KeyRound, Wallet2 } from 'lucide-react';
import { usePurchase } from './usePurchase';
import { TonDiamond } from './ui-bits';
import { fmtTon, faNum } from '@/lib/format';
import { useCart } from './CartProvider';

type Attr = { trait_type: string; value: string | number };

/**
 * اکشن‌های آیتم — همهٔ حالت‌ها واقعی و کارا:
 *  - اجارهٔ لیستینگ سایت: کیف پول داخلی (امانی) یا TON Connect (مستقیم)
 *  - خرید لیستینگ سایت: کیف پول داخلی یا TON Connect (فروشنده + کارمزد در یک تراکنش)
 *  - خرید NFT روی زنجیره: تراکنش واقعی به قرارداد فروش فرگمنت
 *  - اجارهٔ مارکت‌اپ: تراکنش رسمی اجاره
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
  const [fee, setFee] = useState({ percent: 0, wallet: '' });
  const isLocal = !!props.local;
  const isOnchain = !isLocal && !!props.address;

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => setFee({ percent: isLocal ? (j.fee_gifts ?? 0) : (j.fee_rent ?? j.fee_gifts ?? 0), wallet: j.fee_wallet }))
      .catch(() => {});
  }, [isLocal]);

  const minDays = props.minDurationSec ? Math.max(1, Math.round(props.minDurationSec / 86400)) : 1;
  const maxDays = props.maxDurationSec ? Math.max(minDays, Math.round(props.maxDurationSec / 86400)) : 30;
  const rentTotal = Math.round((props.rentPerDayTon ?? 0) * days * 1e9) / 1e9;
  const rentFee = Math.round(rentTotal * fee.percent) / 100;

  async function buy(payWith: 'wallet' | 'ton') {
    if (!props.priceTon) return;
    await purchase('/api/market/buy', isLocal ? { local_id: props.local, pay_with: payWith } : { nft_address: props.address, pay_with: payWith });
  }

  async function rent(payWith: 'wallet' | 'ton') {
    if (!props.rentPerDayTon || !props.address) return;
    await purchase('/api/rent/pay', {
      nft_address: props.address,
      duration: days * 86400,
      price_per_day: String(Math.round((props.rentPerDayTon ?? 0) * 1e9)),
      pay_with: payWith,
    });
  }

  const inCart = isLocal ? cart.has(`local:${props.local}`) : false;
  const currency = props.currency || 'TON';

  const payButtons = (onWallet: () => void, onTon: () => void, label: string, total: number) => (
    <div className="mt-3 space-y-2">
      <button className="btn-primary w-full py-3" onClick={onWallet} disabled={busy}>
        <Wallet2 size={16} />
        {busy ? 'در حال پردازش…' : `${label} با کیف پول سایت — ${fmtTon(total)} TON`}
      </button>
      <button className="btn-ghost w-full py-3" onClick={onTon} disabled={busy}>
        {busy ? 'در حال پردازش…' : `${label} با TON Connect`}
      </button>
      <div className="text-center text-[11px] leading-5 text-muted">
        «کیف پول سایت» = موجودی گرام داخل سایت — سریع و بدون کارمزد شبکه.
        <Link href="/wallet" className="mx-1 text-accent-hi hover:underline">شارژ کیف پول</Link>
      </div>
    </div>
  );

  return (
    <div className="mt-5 space-y-3">
      {/* پنل اجاره کردن */}
      {props.rentPerDayTon ? (
        <div className="card p-4" id="rent">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold text-ok">
              <KeyRound size={15} className="me-1 inline align-[-2px]" /> اجاره کردن این آیتم
            </span>
            <span className="text-muted tabular">
              <TonDiamond className="text-ton" /> {fmtTon(props.rentPerDayTon)} / روز
            </span>
          </div>
          {isLocal && (
            <div className="mb-2 text-[11px] leading-5 text-muted">
              اجارهٔ لیستینگ همین سایت — پرداخت شما تا تحویل آیتم امانی نگه داشته می‌شود.
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
              کارمزد سایت {faNum(fee.percent)}٪ ({rentFee.toFixed(4)} TON) — شفاف و جدا ثبت می‌شود
            </div>
          )}
          {payButtons(() => rent('wallet'), () => rent('ton'), 'پرداخت و اجاره', rentTotal)}
        </div>
      ) : null}

      {/* خرید — لیستینگ سایت یا NFT روی زنجیره */}
      {props.priceTon ? (
        <div className="space-y-2">
          {isLocal ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-4 py-3 text-sm">
                <span className="text-muted">قیمت خرید</span>
                <span className="font-bold tabular"><TonDiamond className="text-ton" /> {fmtTon(props.priceTon)} {currency}</span>
              </div>
              {fee.percent > 0 && (
                <div className="px-1 text-[11px] text-muted">
                  کارمزد سایت {faNum(fee.percent)}٪ — در پرداخت TON همراه تراکنش، در پرداخت کیف پول جدا محاسبه می‌شود
                </div>
              )}
            </>
          ) : null}
          {payButtons(() => buy('wallet'), () => buy('ton'), 'خرید', props.priceTon)}
          {isLocal && (
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
          )}
        </div>
      ) : null}

      {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-xs leading-6 text-bad">{error}</div>}
      {success && (
        <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-xs leading-6 text-ok">
          {success}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/inventory" className="btn-ghost btn-sm">مشاهده انباری</Link>
            {!isLocal && <Link href="/wallet" className="btn-ghost btn-sm">کیف پول من</Link>}
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
