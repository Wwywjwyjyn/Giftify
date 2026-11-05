'use client';

import Link from 'next/link';
import { ShoppingBasket, KeyRound } from 'lucide-react';
import type { FeedItem } from '@/lib/market';
import { fmtTon } from '@/lib/format';
import { TonDiamond, StatusPill } from './ui-bits';
import { ItemImage } from './ItemImage';
import { useCart } from './CartProvider';

/** شبکه کارت گیفت — مثل صفحه Gifts فرگمنت، با دکمهٔ سریع اجاره/سبد */
export function GiftGrid({ items }: { items: FeedItem[] }) {
  const cart = useCart();
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.key} className="card group p-2.5 transition-colors" style={{ transitionProperty: 'border-color' }}>
          <Link href={`/item/${it.address}`} className="block">
            <ItemImage item={{ name: it.name, address: it.address, kind: it.kind, num: it.num }} />
            <div className="mt-2 space-y-1 px-0.5 pb-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs text-muted tabular" dir="ltr">
                  {it.num !== null ? `#${it.num}` : ''}
                </span>
                {it.mode === 'rent' ? <StatusPill kind="rent" /> : it.source === 'local' ? <StatusPill kind="local" /> : <StatusPill kind="buy" />}
              </div>
              <div className="truncate text-xs text-muted">{it.name.replace(/ #\d+/, '')}</div>
              <div className="whitespace-nowrap text-sm font-bold tabular">
                <TonDiamond className="text-ton" /> {fmtTon(it.priceTon ?? 0)}
                {it.mode === 'rent' && <span className="text-[10px] font-normal text-muted"> / روز</span>}
              </div>
            </div>
          </Link>
          {/* اکشن سریع — جدا از لینک کلیک کارت */}
          <div className="mt-2 flex gap-1.5">
            {it.mode === 'rent' ? (
              <Link href={`/item/${it.address}#rent`} className="btn-rent btn-sm w-full">
                <KeyRound size={13} /> اجاره کردن
              </Link>
            ) : (
              <>
                <Link href={`/item/${it.address}`} className="btn-primary btn-sm w-full">خرید</Link>
                <button
                  className="btn-ghost btn-sm px-2"
                  title="افزودن به سبد خرید"
                  onClick={() =>
                    cart.add({
                      id: `local:${it.address?.replace('local:', '')}`,
                      source: 'local',
                      localId: it.address?.replace('local:', ''),
                      kind: it.kind,
                      name: it.name,
                      sub: it.sub,
                      priceTon: it.priceTon ?? 0,
                      attrs: it.attrs,
                    })
                  }
                >
                  <ShoppingBasket size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="col-span-full py-10 text-center text-sm text-muted">موردی یافت نشد</div>
      )}
    </div>
  );
}
