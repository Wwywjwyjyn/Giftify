'use client';

import Link from 'next/link';
import type { FeedItem } from '@/lib/market';
import { fmtTon } from '@/lib/format';
import { TonDiamond, StatusPill } from './ui-bits';

function GiftTile({ item, size = 'h-36' }: { item: FeedItem; size?: string }) {
  const slug = item.collectionSlug;
  const img = item.address && slug && item.num ? `https://nft.fragment.com/gift/${slug}-${item.num}.webp` : null;
  const fallbackChar = (item.name || '?').replace(/#\d+/, '').trim().slice(0, 1) || 'گیفت';
  if (img) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={img} alt={item.name} className={`${size} w-full rounded-lg bg-panel2 object-cover`} loading="lazy" />
    );
  }
  return (
    <div className={`${size} flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-panel2 to-[#22303F] text-3xl font-black text-accent-hi/70`}>
      {fallbackChar}
    </div>
  );
}

/** شبکه کارت گیفت مثل صفحه Gifts فرگمنت */
export function GiftGrid({ items, mode }: { items: FeedItem[]; mode: 'sale' | 'rent' }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((it) => {
        const href = it.source === 'local' ? `/item/local:${it.key.replace('local:', '')}` : `/item/${it.address}`;
        return (
          <Link key={it.key} href={href} className="card group p-2.5 transition-colors hover:border-accent">
            <GiftTile item={it} />
            <div className="mt-2 space-y-1 px-0.5 pb-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs text-muted" dir="ltr">
                  {it.num !== null ? `#${it.num}` : ''}
                </span>
                {it.mode === 'rent' ? <StatusPill kind="rent" /> : it.source === 'local' ? <StatusPill kind="local" /> : <StatusPill kind="sale" />}
              </div>
              <div className="truncate text-xs text-muted">{it.name.replace(/ #\d+/, '')}</div>
              <div className="whitespace-nowrap text-sm font-bold">
                <TonDiamond className="text-ton" /> {fmtTon(it.priceTon ?? 0)}
                {mode === 'rent' && <span className="text-[10px] font-normal text-muted"> / روز</span>}
              </div>
            </div>
          </Link>
        );
      })}
      {items.length === 0 && (
        <div className="col-span-full py-10 text-center text-sm text-muted">موردی یافت نشد</div>
      )}
    </div>
  );
}
