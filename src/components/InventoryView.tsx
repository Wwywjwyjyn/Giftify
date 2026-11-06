'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, KeyRound, Store, ShoppingBasket, RefreshCw } from 'lucide-react';
import { ItemImage } from './ItemImage';
import { fmtTon, faNum, fmtDaysLeft } from '@/lib/format';
import { TonDiamond, StatusPill } from './ui-bits';
import { usePurchase } from './usePurchase';

type Order = {
  id: string; kind: string; title: string; amountTon: number; feeTon: number; currency: string;
  status: string; meta: string; payMethod?: string | null; nftAddress?: string | null;
  sellerWallet?: string | null; endAt?: string | null; createdAt: string;
};

type RentOrder = {
  id: string; title: string; amountTon: number; status: string; payMethod?: string | null;
  nftAddress?: string | null; sellerWallet?: string | null; endAt?: string | null;
  role: 'owner' | 'renter'; renterWallet?: string | null; createdAt: string;
};

const STATUS_FA: Record<string, string> = {
  PENDING_TX: 'در انتظار پرداخت',
  TX_SENT: 'پرداخت شد — در انتظار تأیید',
  AWAITING_DELIVERY: 'در صف تحویل',
  DELIVERED: 'تحویل داده شد',
  DONE: 'تکمیل شد',
  FAILED: 'ناموفق',
  CANCELLED: 'لغو شد',
  REFUNDED: 'مبلغ برگشت داده شد',
  RENT_ACTIVE: 'در انتظار تحویل مالک',
  RENT_OVERDUE: 'مهلت تمام — باید برگردد',
};

const STATUS_COLOR: Record<string, string> = {
  DONE: 'text-ok', DELIVERED: 'text-ok', REFUNDED: 'text-ok',
  FAILED: 'text-bad', RENT_OVERDUE: 'text-bad',
  AWAITING_DELIVERY: 'text-accent-hi', TX_SENT: 'text-accent-hi', RENT_ACTIVE: 'text-accent-hi',
};

/** انباری — چیزهایی که خریده‌ای + اجاره‌های فعال */
export default function InventoryView() {
  const { sendTx, busy } = usePurchase();
  const [tab, setTab] = useState<'purchases' | 'rented' | 'requests' | 'listings'>('purchases');
  const [orders, setOrders] = useState<Order[]>([]);
  const [rentOrders, setRentOrders] = useState<RentOrder[]>([]);
  const [listings, setListings] = useState<{ id: string; kind: string; name: string; priceTon?: number | null; rentPerDayTon?: number | null }[]>([]);
  const [me, setMe] = useState<{ wallet?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [rm, ro, rentRes, rl] = await Promise.all([
        fetch('/api/auth/me').then((r) => r.json()).catch(() => ({})),
        fetch('/api/orders', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/rent/orders', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/inventory/listings', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      ]);
      setMe(rm.user || null);
      setOrders(ro.orders || []);
      setRentOrders(rentRes.orders || []);
      setListings(rl.listings || []);
      if (rl.detail) setNotice(rl.detail);
    } catch {
      /* شبکه */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** بررسی زنجیره: تحویل/برگشت/تسویهٔ خودکار سفارش‌های اجاره */
  async function verifyAll() {
    const targets = rentOrders.filter((o) => ['RENT_ACTIVE', 'DELIVERED', 'RENT_OVERDUE'].includes(o.status) && o.nftAddress);
    for (const o of targets) {
      await fetch('/api/rent/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: o.id }),
      }).catch(() => {});
    }
    if (targets.length) await load();
  }

  useEffect(() => {
    if (rentOrders.some((o) => ['RENT_ACTIVE', 'DELIVERED', 'RENT_OVERDUE'].includes(o.status) && o.nftAddress)) {
      verifyAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentOrders.length]);

  async function deliver(o: RentOrder) {
    const r = await fetch('/api/rent/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: o.id }),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      setFlash({ ok: false, text: j.detail || 'تحویل ممکن نشد' });
      return;
    }
    const res = await sendTx(j.tx);
    if (res.ok) {
      setFlash({ ok: true, text: 'تراکنش انتقال ارسال شد — پس از تأیید شبکه، اجاره تحویل‌شده علامت می‌خورد' });
      await load();
    }
  }

  async function returnItem(o: RentOrder) {
    const r = await fetch('/api/rent/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: o.id }),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      setFlash({ ok: false, text: j.detail || 'بازگرداندن ممکن نشد' });
      return;
    }
    const res = await sendTx(j.tx);
    if (res.ok) {
      setFlash({ ok: true, text: 'تراکنش بازگشت ارسال شد — پس از تأیید شبکه، تسویه انجام می‌شود' });
      await load();
    }
  }

  const purchases = orders.filter((o) => ['nft', 'local_buy', 'stars', 'premium', 'ads', 'telegram_topup'].includes(o.kind));
  const myRents = rentOrders.filter((o) => o.role === 'renter');
  const requests = rentOrders.filter((o) => o.role === 'owner');

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="hero-title">انباری من</h1>
      <p className="hero-sub mt-2">
        {me?.wallet
          ? `کیف پول: ${me.wallet.slice(0, 10)}…${me.wallet.slice(-6)}`
          : 'برای ذخیرهٔ خودکار خریدها، از هدر کیف پول خود را وصل کنید'}
      </p>

      <div className="mb-4 mt-6 flex gap-4 overflow-x-auto border-b border-line sm:gap-6">
        <button className={`tab whitespace-nowrap ${tab === 'purchases' ? 'active' : ''}`} onClick={() => setTab('purchases')}>
          <Package size={15} className="inline align-[-2px]" /> خریدهای من
        </button>
        <button className={`tab whitespace-nowrap ${tab === 'rented' ? 'active' : ''}`} onClick={() => setTab('rented')}>
          <KeyRound size={15} className="inline align-[-2px]" /> اجاره‌های من
        </button>
        <button className={`tab whitespace-nowrap ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          <Store size={15} className="inline align-[-2px]" /> درخواست‌های اجاره
        </button>
        <button className={`tab whitespace-nowrap ${tab === 'listings' ? 'active' : ''}`} onClick={() => setTab('listings')}>
          <ShoppingBasket size={15} className="inline align-[-2px]" /> لیستینگ‌های من
        </button>
      </div>

      {flash && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-xs leading-6 ${flash.ok ? 'border-ok/30 bg-ok/10 text-ok' : 'border-bad/30 bg-bad/10 text-bad'}`}>
          {flash.text}
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><span className="spin" /></div>}

      {!loading && tab === 'purchases' && (
        <div className="space-y-2.5">
          {purchases.length === 0 && (
            <div className="card p-10 text-center text-sm leading-7 text-muted">
              هنوز خریدی ثبت نشده است. بعد از اولین خرید، آیتم اینجا می‌آید.
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/gifts" className="btn-primary btn-sm">رفتن به بازار</Link>
                <Link href="/wallet" className="btn-ghost btn-sm">شارژ کیف پول</Link>
              </div>
            </div>
          )}
          {purchases.map((o) => <OrderRow key={o.id} o={o} />)}
        </div>
      )}

      {!loading && tab === 'rented' && (
        <div className="space-y-2.5">
          {myRents.length === 0 && (
            <div className="card p-10 text-center text-sm leading-7 text-muted">
              اجارهٔ فعالی ندارید — از بخش <Link href="/rent" className="text-accent-hi hover:underline">اجاره</Link> شروع کنید.
            </div>
          )}
          {myRents.map((o) => (
            <RentRow key={o.id} o={o} busy={busy} onDeliver={deliver} onReturn={returnItem} />
          ))}
        </div>
      )}

      {!loading && tab === 'requests' && (
        <div className="space-y-2.5">
          {requests.length === 0 && (
            <div className="card p-10 text-center text-sm leading-7 text-muted">
              درخواست اجاره‌ای برای لیستینگ‌های شما نیست.
            </div>
          )}
          {requests.map((o) => (
            <RentRow key={o.id} o={o} busy={busy} onDeliver={deliver} onReturn={returnItem} />
          ))}
        </div>
      )}

      {!loading && tab === 'listings' && (
        <div className="space-y-2.5">
          {notice && (
            <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs leading-6 text-accent-hi">
              {notice}
            </div>
          )}
          {listings.length === 0 && (
            <div className="card p-10 text-center text-sm leading-7 text-muted">
              لیستینگی به نام کیف پول شما نیست. لیستینگ‌ها از پنل مدیریت یا پشتیبانی ثبت می‌شوند.
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
                {l.rentPerDayTon ? <div><TonDiamond className="text-ton" /> {fmtTon(l.rentPerDayTon)} / روز</div> : null}
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

function OrderRow({ o }: { o: Order }) {
  return (
    <div className="card flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill kind={o.kind === 'rent' || o.kind === 'local_rent' ? 'rent' : 'buy'} />
          <span className="truncate text-sm font-bold">{o.title}</span>
        </div>
        <div className="mt-1 text-xs text-muted">
          {new Date(o.createdAt).toLocaleString('fa-IR')}
          {o.payMethod === 'wallet' ? ' — پرداخت با کیف پول سایت' : o.payMethod === 'ton' ? ' — پرداخت با TON' : ''}
        </div>
      </div>
      <div className="shrink-0 text-end">
        <div className="text-sm font-bold tabular"><TonDiamond className="text-ton" /> {fmtTon(o.amountTon)} {o.currency}</div>
        <div className={`text-[11px] font-bold ${STATUS_COLOR[o.status] || 'text-accent-hi'}`}>
          {STATUS_FA[o.status] || o.status}
        </div>
      </div>
    </div>
  );
}

function RentRow({ o, busy, onDeliver, onReturn }: { o: RentOrder; busy: boolean; onDeliver: (o: RentOrder) => void; onReturn: (o: RentOrder) => void }) {
  const canDeliver = o.role === 'owner' && ['RENT_ACTIVE', 'PENDING_TX', 'TX_SENT'].includes(o.status) && o.nftAddress;
  const canReturn = o.role === 'renter' && ['DELIVERED', 'RENT_ACTIVE', 'RENT_OVERDUE'].includes(o.status) && o.nftAddress;
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusPill kind="rent" />
            <span className="truncate text-sm font-bold">{o.title}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {o.role === 'owner' ? 'اجاره‌دهنده: شما' : 'اجاره‌گیرنده: شما'}
            {o.renterWallet && o.role === 'owner' ? ` — گیرنده: ${o.renterWallet.slice(0, 8)}…${o.renterWallet.slice(-4)}` : ''}
          </div>
          {o.endAt && <div className="mt-0.5 text-[11px] text-muted">پایان: {fmtDaysLeft(Math.floor(new Date(o.endAt).getTime() / 1000))}</div>}
        </div>
        <div className="shrink-0 text-end">
          <div className="text-sm font-bold tabular"><TonDiamond className="text-ton" /> {fmtTon(o.amountTon)} TON</div>
          <div className={`text-[11px] font-bold ${STATUS_COLOR[o.status] || 'text-accent-hi'}`}>{STATUS_FA[o.status] || o.status}</div>
        </div>
      </div>
      {(canDeliver || canReturn) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canDeliver && (
            <button className="btn-rent btn-sm" onClick={() => onDeliver(o)} disabled={busy}>
              <KeyRound size={13} /> تحویل با انتقال واقعی NFT
            </button>
          )}
          {canReturn && (
            <button className="btn-ghost btn-sm" onClick={() => onReturn(o)} disabled={busy}>
              <RefreshCw size={13} /> بازگرداندن آیتم به مالک
            </button>
          )}
          <button
            className="btn-ghost btn-sm"
            onClick={async () => {
              await fetch('/api/rent/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: o.id }),
              });
              window.location.reload();
            }}
            disabled={busy}
            title="بررسی مالکیت روی زنجیره و تسویهٔ خودکار"
          >
            <RefreshCw size={13} /> بررسی زنجیره
          </button>
        </div>
      )}
          {o.status === 'RENT_OVERDUE' && (
        <div className="mt-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[11px] leading-5 text-bad">
          مهلت اجاره تمام شده است — لطفاً آیتم را بازگردانید تا تسویه انجام شود.
        </div>
      )}
    </div>
  );
}
