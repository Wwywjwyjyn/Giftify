'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Wallet, KeyRound, Info } from 'lucide-react';
import { ItemImage } from './ItemImage';
import { fmtTon } from '@/lib/format';
import { TonDiamond, StatusPill } from './ui-bits';

type Order = { id: string; kind: string; title: string; amountTon: number; feeTon: number; currency: string; status: string; meta: string; createdAt: string };
type Rented = { nft_address?: string; nft_name?: string; price_per_day?: string; end_time?: number };

const STATUS_FA: Record<string, string> = { PENDING_TX: 'در انتظار پرداخت', TX_SENT: 'ارسال شد', DONE: 'تکمیل شد', FAILED: 'ناموفق' };

/**
 * انباری — چیزهایی که خریده‌ای + اجاره‌های فعال:
 *  ۱) خریدهای ثبت‌شده (سفارش‌های خرید/اجارهٔ این کاربر)
 *  ۲) «اجاره‌های من» واقعی از مارکت‌اپ (کیف پول توکن API)
 */
export default function InventoryView() {
  const [tab, setTab] = useState<'purchases' | 'rented' | 'listings'>('purchases');
  const [orders, setOrders] = useState<Order[]>([]);
  const [rented, setRented] = useState<Rented[]>([]);
  const [listings, setListings] = useState<{ id: string; kind: string; name: string; priceTon?: number | null; rentPerDayTon?: number | null }[]>([]);
  const [me, setMe] = useState<{ wallet?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((j) => setMe(j.user)).catch(() => {});
    fetch('/api/orders', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setOrders(j.orders || []))
      .catch(() => {});
    fetch('/api/rent/my', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => (j.items ? setRented(j.items) : setRented([])))
      .catch(() => {});
    fetch('/api/inventory/listings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        setListings(j.listings || []);
        if (j.detail) setNotice(j.detail);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const purchases = orders.filter((o) => o.kind === 'nft');
  const rents = orders.filter((o) => o.kind === 'rent');

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="hero-title">انباری من</h1>
      <p className="hero-sub mt-2">
        {me?.wallet
          ? `کیف پول: ${me.wallet.slice(0, 10)}…${me.wallet.slice(-6)}`
          : 'برای ذخیرهٔ خودکار خریدها، از هدر کیف پول خود را وصل کنید'}
      </p>

      <div className="mb-4 mt-6 flex gap-6 border-b border-line">
        <button className={`tab ${tab === 'purchases' ? 'active' : ''}`} onClick={() => setTab('purchases')}>
          <Package size={15} className="inline align-[-2px]" /> خریدهای من
        </button>
        <button className={`tab ${tab === 'rented' ? 'active' : ''}`} onClick={() => setTab('rented')}>
          <KeyRound size={15} className="inline align-[-2px]" /> اجاره‌های فعال
        </button>
        <button className={`tab ${tab === 'listings' ? 'active' : ''}`} onClick={() => setTab('listings')}>
          <Wallet size={15} className="inline align-[-2px]" /> اجاره‌دهی‌های من
        </button>
      </div>

      {loading && <div className="flex justify-center py-12"><span className="spin" /></div>}

      {!loading && tab === 'purchases' && (
        <div className="space-y-2.5">
          {purchases.length === 0 && rents.length === 0 && (
            <div className="card p-10 text-center text-sm leading-7 text-muted">
              هنوز خریدی ثبت نشده است. بعد از اولین خرید، آیتم اینجا می‌آید.
              <div className="mt-4"><Link href="/gifts" className="btn-primary btn-sm">رفتن به بازار</Link></div>
            </div>
          )}
          {purchases.map((o) => (
            <OrderRow key={o.id} o={o} label="خرید" />
          ))}
          {rents.map((o) => (
            <OrderRow key={o.id} o={o} label="اجاره" />
          ))}
        </div>
      )}

      {!loading && tab === 'rented' && (
        <div className="space-y-2.5">
          {rented.length === 0 && (
            <div className="card p-10 text-center text-sm leading-7 text-muted">
              اجارهٔ فعالی نیست. با اتصال کیف پول توکن API مارکت‌اپ، «اجاره‌های من» واقعی اینجا نمایش داده می‌شود.
            </div>
          )}
          {rented.map((r, i) => (
            <div key={i} className="card flex items-center gap-3 p-3">
              <ItemImage item={{ name: r.nft_name || 'NFT', address: r.nft_address, kind: 'gifts' }} size="h-14 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{r.nft_name || 'NFT'}</div>
                <div className="mt-0.5 text-xs text-muted">
                  تا {r.end_time ? new Date(r.end_time * 1000).toLocaleDateString('fa-IR') : '—'}
                </div>
              </div>
              <div className="text-sm font-bold tabular">
                <TonDiamond className="text-ton" /> {fmtTon(Number(r.price_per_day || 0) / 1e9)} / روز
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'listings' && (
        <div className="space-y-2.5">
          {notice && (
            <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs leading-6 text-accent-hi">
              <Info size={12} className="inline align-[-1px]" /> {notice}
            </div>
          )}
          {listings.length === 0 && (
            <div className="card p-10 text-center text-sm leading-7 text-muted">
              لیستینگی به نام کیف پول شما نیست. اجاره‌دهی‌های واقعی از طریق پنل مدیریت ثبت می‌شوند.
            </div>
          )}
          {listings.map((l) => (
            <div key={l.id} className="card flex items-center gap-3 p-3">
              <ItemImage item={{ name: l.name, address: `local:${l.id}`, kind: l.kind === 'gift' ? 'gifts' : l.kind === 'username' ? 'usernames' : 'numbers' }} size="h-14 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{l.name}</div>
                <div className="mt-1 flex gap-1.5">
                  {l.rentPerDayTon ? <StatusPill kind="rent" /> : null}
                  {l.priceTon ? <StatusPill kind="buy" /> : null}
                </div>
              </div>
              <div className="text-end text-sm font-bold tabular">
                {l.rentPerDayTon ? <><TonDiamond className="text-ton" /> {fmtTon(l.rentPerDayTon)} / روز</> : null}
                {l.priceTon ? <div><TonDiamond className="text-ton" /> {fmtTon(l.priceTon)}</div> : null}
              </div>
              <Link href={`/item/local:${l.id}`} className="btn-ghost btn-sm shrink-0">مشاهده</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({ o, label }: { o: Order; label: string }) {
  return (
    <div className="card flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusPill kind={label === 'اجاره' ? 'rent' : 'buy'} />
          <span className="truncate text-sm font-bold">{o.title}</span>
        </div>
        <div className="mt-1 text-xs text-muted">{new Date(o.createdAt).toLocaleString('fa-IR')}</div>
      </div>
      <div className="shrink-0 text-end">
        <div className="text-sm font-bold tabular"><TonDiamond className="text-ton" /> {fmtTon(o.amountTon)} {o.currency}</div>
        <div className={`text-[11px] font-bold ${o.status === 'FAILED' ? 'text-bad' : o.status === 'DONE' ? 'text-ok' : 'text-accent-hi'}`}>
          {STATUS_FA[o.status] || o.status}
        </div>
      </div>
    </div>
  );
}
