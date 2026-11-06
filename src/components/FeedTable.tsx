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

function useOpenItem() {
  const router = useRouter();
  return (it: FeedItem) => router.push(`/item/${it.address}`);
}

/**
 * جدول فرگمنتی — ستون‌های مرتب: آیتم | ویژگی‌ها | قیمت | مدت | عمل
 * دسکتاپ: جدول دقیق مثل فرگمنت. موبایل: ردیف‌های کارتی هم‌تراز (بدون اسکرول افقی و
 * بدون رفتن قیمت/دکمه به دو خط نامرتب — دقیقاً چیدمان فرگمنت در موبایل).
 */
export function FeedTable({ section, items }: { section: 'usernames' | 'numbers' | 'gifts'; items: FeedItem[] }) {
  const cart = useCart();
  const openItem = useOpenItem();
  const hasAttrs = section === 'gifts' && items.some((i) => i.attrs.length > 0);

  const ActionCell = ({ it, full }: { it: FeedItem; full?: boolean }) => {
    if (it.mode === 'rent') {
      return (
        <Link
          href={`/item/${it.address}#rent`}
          className={`btn-rent ${full ? 'w-full py-2' : 'btn-sm'} whitespace-nowrap justify-center`}
          title={`اجاره کردن ${it.name}`}
        >
          <KeyRound size={13} /> اجاره کردن
        </Link>
      );
    }
    return (
      <div className={`flex items-center gap-1.5 ${full ? 'w-full' : ''}`}>
        <Link href={`/item/${it.address}`} className={`btn-primary ${full ? 'flex-1 py-2' : 'btn-sm'} whitespace-nowrap justify-center`}>
          خرید
        </Link>
        <button
          className={`btn-ghost ${full ? 'py-2' : 'btn-sm'} px-2.5`}
          title="افزودن به سبد خرید"
          aria-label="افزودن به سبد خرید"
          onClick={(e) => {
            e.stopPropagation();
            cart.add({
              id: `local:${it.address?.replace('local:', '')}`,
              source: 'local',
              localId: it.address?.replace('local:', ''),
              kind: section,
              name: it.name,
              sub: it.sub,
              priceTon: it.priceTon ?? 0,
              attrs: it.attrs,
            });
          }}
        >
          <ShoppingBasket size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="card overflow-hidden">
      {/* ---------- دسکتاپ: جدول فرگمنت ---------- */}
      <div className="hidden md:block overflow-x-auto">
        <table className="ftable min-w-[560px]">
          <thead>
            <tr>
              <th className="w-1/2">{section === 'usernames' ? 'یوزرنیم' : section === 'numbers' ? 'شماره کلکسیونی' : 'گیفت'}</th>
              {hasAttrs && <th>ویژگی‌ها</th>}
              <th>قیمت</th>
              <th>مدت / وضعیت</th>
              <th className="w-[1%]">عمل</th>
              <th className="w-8"><span className="sr-only">باز کردن</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.key} onClick={() => openItem(it)} title="مشاهده جزئیات">
                <td>
                  <NameCell item={it} />
                </td>
                {hasAttrs && (
                  <td>
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
                <td className="text-xs text-muted whitespace-nowrap">
                  {it.mode === 'rent'
                    ? fmtDurationRange(it.minDurationSec ?? 86400, it.maxDurationSec ?? 86400)
                    : it.source === 'local'
                      ? 'خرید آنی از سایت'
                      : '—'}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <ActionCell it={it} />
                </td>
                <td>
                  <ChevronLeft size={16} className="text-muted" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- موبایل: ردیف‌های کارتی هم‌تراز مثل فرگمنت ---------- */}
      <div className="md:hidden divide-y divide-[#121b26]">
        {items.map((it) => (
          <div key={it.key} className="p-3 active:bg-[#111c29]" onClick={() => openItem(it)} role="button" aria-label={it.name}>
            {/* خط ۱: عکس + نام + قیمت (همه در یک خط) */}
            <div className="flex items-center gap-3">
              <ItemImage item={{ name: it.name, address: it.address, kind: it.kind, num: it.num }} size="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">{it.name}</div>
                {it.sub && <div className="mt-0.5 truncate text-[11px] text-accent-hi" dir="ltr">{it.sub}</div>}
              </div>
              <div className="shrink-0 text-end">
                <div className="text-sm font-bold text-ink tabular whitespace-nowrap">
                  <TonDiamond className="text-ton" /> {fmtTon(it.priceTon ?? 0)}
                </div>
                <div className="text-[10px] text-muted">{it.mode === 'rent' ? 'هر روز' : 'کل مبلغ'}</div>
              </div>
            </div>
            {/* خط ۲: وضعیت + مدت — تراز و فشرده */}
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
              {it.source === 'local' && <StatusPill kind="local" />}
              {it.mode === 'rent' ? <StatusPill kind="rent" /> : <StatusPill kind="buy" />}
              <span className="tabular">
                {it.mode === 'rent' ? fmtDurationRange(it.minDurationSec ?? 86400, it.maxDurationSec ?? 86400) : it.source === 'local' ? 'خرید آنی از سایت' : ''}
              </span>
            </div>
            {/* خط ۳: دکمه‌ها تمام‌عرض */}
            <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
              <ActionCell it={it} full />
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted">موردی یافت نشد</div>}
    </div>
  );
}

/** شمارندهٔ خلاصه — «۴۸ مورد» */
export function ItemCount({ n }: { n: number }) {
  return <span className="text-xs text-muted tabular">{faNum(n)} مورد</span>;
}
