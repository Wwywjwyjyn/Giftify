'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ShoppingBasket, KeyRound } from 'lucide-react';
import type { FeedItem } from '@/lib/market';
import { fmtTon, fmtDurationRange, faNum } from '@/lib/format';
import { TonDiamond, StatusPill } from './ui-bits';
import { ItemImage } from './ItemImage';
import { useCart } from './CartProvider';

/** ستون نام آیتم — نظم فرگمنت: نام، لینک، برچسب وضعیت */
function NameCell({ item }: { item: FeedItem }) {
  return (
    <div className="flex items-center gap-3">
      <ItemImage item={{ name: item.name, address: item.address, kind: item.kind, num: item.num }} size="h-12 w-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-ink">{item.name}</div>
        {item.sub && <div className="mt-0.5 truncate text-xs text-accent-hi" dir="ltr">{item.sub}</div>}
        <div className="mt-1 flex items-center gap-1.5">
          {item.source === 'local' && <StatusPill kind="local" />}
          {item.mode === 'rent' ? <StatusPill kind="rent" /> : <StatusPill kind="buy" />}
        </div>
      </div>
    </div>
  );
}

/**
 * جدول فرگمنتی — ستون‌های مرتب: آیتم | ویژگی‌ها | قیمت | مدت | عمل
 * دکمهٔ «اجاره کردن» در همهٔ بخش‌ها (گیفت/یوزرنیم/شماره) روی ردیف‌های اجاره‌دار.
 */
export function FeedTable({ section, items }: { section: 'usernames' | 'numbers' | 'gifts'; items: FeedItem[] }) {
  const router = useRouter();
  const cart = useCart();
  const hasAttrs = section === 'gifts' && items.some((i) => i.attrs.length > 0);

  const openItem = (it: FeedItem) => {
    const href = it.address?.startsWith('local:') ? `/item/${it.address}` : `/item/${it.address}`;
    router.push(href);
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="ftable min-w-[560px]">
          <thead>
            <tr>
              <th className="w-1/2">{section === 'usernames' ? 'یوزرنیم' : section === 'numbers' ? 'شماره کلکسیونی' : 'گیفت'}</th>
              {hasAttrs && <th className="hidden md:table-cell">ویژگی‌ها</th>}
              <th>قیمت</th>
              <th className="hidden sm:table-cell">مدت / وضعیت</th>
              <th className="w-[1%]">عمل</th>
              <th className="w-8"><span className="sr-only">باز کردن</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.key}
                onClick={() => openItem(it)}
                title="مشاهده جزئیات"
              >
                <td>
                  <NameCell item={it} />
                </td>
                {hasAttrs && (
                  <td className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {it.attrs.slice(0, 3).map((a, idx) => (
                        <span key={idx} className="chip">{a.value}</span>
                      ))}
                    </div>
                  </td>
                )}
                <td className="whitespace-nowrap">
                  <span className="font-bold text-ink tabular">
                    <TonDiamond className="text-ton" /> {fmtTon(it.priceTon ?? 0)}
                    {it.mode === 'rent' && <span className="text-xs font-normal text-muted"> / روز</span>}
                  </span>
                </td>
                <td className="hidden text-xs text-muted sm:table-cell">
                  {it.mode === 'rent'
                    ? fmtDurationRange(it.minDurationSec ?? 86400, it.maxDurationSec ?? 86400)
                    : it.source === 'local'
                      ? 'خرید آنی از سایت'
                      : '—'}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {it.mode === 'rent' ? (
                    <Link
                      href={`/item/${it.address}#rent`}
                      className="btn-rent btn-sm whitespace-nowrap"
                      title={`اجاره کردن ${it.name}`}
                    >
                      <KeyRound size={13} /> اجاره کردن
                    </Link>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Link href={`/item/${it.address}`} className="btn-primary btn-sm whitespace-nowrap">
                        خرید
                      </Link>
                      <button
                        className="btn-ghost btn-sm px-2"
                        title="افزودن به سبد خرید"
                        onClick={() =>
                          cart.add({
                            id: `local:${it.address?.replace('local:', '')}`,
                            source: 'local',
                            localId: it.address?.replace('local:', ''),
                            kind: section,
                            name: it.name,
                            sub: it.sub,
                            priceTon: it.priceTon ?? 0,
                            attrs: it.attrs,
                          })
                        }
                      >
                        <ShoppingBasket size={14} />
                      </button>
                    </div>
                  )}
                </td>
                <td>
                  <ChevronLeft size={16} className="text-muted" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted">موردی یافت نشد</div>}
    </div>
  );
}

/** شمارندهٔ خلاصه — «۴۸ مورد» */
export function ItemCount({ n }: { n: number }) {
  return <span className="text-xs text-muted tabular">{faNum(n)} مورد</span>;
}
