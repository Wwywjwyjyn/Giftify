'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { FeedItem } from '@/lib/market';
import { fmtNanoTon, fmtTon, fmtDurationRange, fmtDaysLeft } from '@/lib/format';
import { TonDiamond, StatusPill } from './ui-bits';

function PriceCell({ item }: { item: FeedItem }) {
  if (item.mode === 'rent') {
    return (
      <span className="whitespace-nowrap font-bold text-ink">
        <TonDiamond className="text-ton" /> {fmtTon(item.priceTon ?? 0)} <span className="text-xs font-normal text-muted">/ روز</span>
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap font-bold text-ink">
      <TonDiamond className="text-ton" /> {fmtTon(item.priceTon ?? 0)}
    </span>
  );
}

function NameCell({ item }: { item: FeedItem }) {
  const inner = (
    <>
      <div className="font-bold text-ink">{item.name}</div>
      {item.sub && <div className="mt-0.5 text-xs text-accent-hi" dir="ltr">{item.sub}</div>}
      {item.source === 'local' && <div className="mt-1"><StatusPill kind="local" /></div>}
      {item.mode === 'rent' && item.source === 'marketapp' && <div className="mt-1"><StatusPill kind="rent" /></div>}
    </>
  );
  return inner;
}

/** جدول فرگمنتی — ستون‌ها بر اساس بخش و حالت */
export function FeedTable({ section, mode, items }: { section: 'usernames' | 'numbers' | 'gifts'; mode: 'sale' | 'rent'; items: FeedItem[] }) {
  const hasTime = items.some((i) => i.endTimeSec);
  const hasAttrs = section === 'gifts' && items.some((i) => i.attrs.length > 0);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="ftable min-w-[560px]">
          <thead>
            <tr>
              <th className="w-1/2">{section === 'usernames' ? 'یوزرنیم' : section === 'numbers' ? 'شماره کلکسیونی' : 'گیفت'}</th>
              {hasAttrs && <th className="hidden md:table-cell">ویژگی‌ها</th>}
              <th>{mode === 'rent' ? 'قیمت هر روز' : section === 'usernames' || (hasTime && section === 'numbers') ? 'حداقل پیشنهاد' : 'قیمت'}</th>
              <th className="hidden sm:table-cell">{mode === 'rent' ? 'بازه اجاره' : hasTime ? 'زمان باقی‌مانده' : 'وضعیت'}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const href = it.source === 'local' ? `/item/local:${it.key.replace('local:', '')}` : `/item/${it.address}`;
              return (
                <tr key={it.key} onClick={() => (window.location.href = href)}>
                  <td>
                    <NameCell item={it} />
                  </td>
                  {hasAttrs && (
                    <td className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {it.attrs.slice(0, 3).map((a, idx) => (
                          <span key={idx} className="rounded bg-panel2 px-2 py-0.5 text-[11px] text-muted">
                            {a.value}
                          </span>
                        ))}
                      </div>
                    </td>
                  )}
                  <td>
                    <PriceCell item={it} />
                  </td>
                  <td className="hidden sm:table-cell text-xs text-muted">
                    {mode === 'rent'
                      ? fmtDurationRange(it.minDurationSec ?? 86400, it.maxDurationSec ?? 86400)
                      : it.endTimeSec
                        ? fmtDaysLeft(it.endTimeSec)
                        : it.source === 'local'
                          ? 'لیستینگ این سایت'
                          : 'فروش آنی'}
                  </td>
                  <td>
                    <ChevronLeft size={16} className="text-muted" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted">موردی یافت نشد</div>}
    </div>
  );
}
