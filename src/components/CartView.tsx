'use client';

import Link from 'next/link';
import { Trash2, ShoppingBasket } from 'lucide-react';
import { useCart } from './CartProvider';
import { usePurchase } from './usePurchase';
import { ItemImage } from './ItemImage';
import { fmtTon } from '@/lib/format';
import { TonDiamond } from './ui-bits';

export default function CartView() {
  const cart = useCart();
  const { purchase, busy, error, success } = usePurchase();

  async function buyOne(id: string, localId: string) {
    const r = await purchase('/api/market/buy', { local_id: localId });
    if (r.ok) cart.remove(id);
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <div className="card p-12">
          <ShoppingBasket size={44} className="mx-auto mb-4 text-muted" />
          <h1 className="text-xl font-bold">سبد خرید خالی است</h1>
          <p className="mt-2 text-sm leading-7 text-muted">
            از بازار گیفت‌ها، یوزرنیم‌ها یا شماره‌ها، آیتم‌های «خرید» را به سبد اضافه کنید؛ آیتم‌های «اجاره» مستقیماً از صفحهٔ خودشان پرداخت می‌شوند.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/gifts" className="btn-primary">بازار گیفت‌ها</Link>
            <Link href="/inventory" className="btn-ghost">انباری من</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="hero-title">سبد خرید</h1>
        <button className="btn-ghost btn-sm" onClick={cart.clear} disabled={busy}>
          <Trash2 size={14} /> خالی کردن
        </button>
      </div>

      <div className="stagger space-y-2.5">
        {cart.items.map((it) => (
          <div key={it.id} className="card flex items-center gap-3 p-3">
            <ItemImage item={{ name: it.name, address: it.address, kind: it.kind }} size="h-14 w-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{it.name}</div>
              <div className="mt-0.5 text-xs text-muted">
                {it.kind === 'usernames' ? 'یوزرنیم' : it.kind === 'numbers' ? 'شماره کلکسیونی' : 'گیفت'} — لیستینگ سایت
              </div>
            </div>
            <div className="shrink-0 text-end">
              <div className="text-sm font-bold tabular">
                <TonDiamond className="text-ton" /> {fmtTon(it.priceTon)} TON
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <button className="btn-primary btn-sm" onClick={() => buyOne(it.id, it.localId!)} disabled={busy}>
                  خرید
                </button>
                <button className="btn-ghost btn-sm px-2" onClick={() => cart.remove(it.id)} aria-label="حذف">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-4 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">مجموع سبد</span>
          <span className="text-lg font-bold tabular"><TonDiamond className="text-ton" /> {fmtTon(cart.totalTon)} TON</span>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted">
          پرداخت هر آیتم یک تراکنش مستقل است: مبلغ به کیف پول فروشنده می‌رود و کارمزد سایت شفاف و جداگانه ثبت می‌شود.
        </p>
        {error && <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-xs leading-6 text-bad">{error}</div>}
        {success && <div className="mt-3 rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-xs leading-6 text-ok">{success}</div>}
        <Link href="/inventory" className="btn-ghost mt-3 w-full">رفتن به انباری</Link>
      </div>
    </div>
  );
}
