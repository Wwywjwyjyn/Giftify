'use client';

import { useState } from 'react';
import { giftImageFromItemName } from '@/lib/giftimg';

/**
 * عکس آیتم با زنجیرهٔ فال‌بک کامل:
 *  ۱) الگوی فرگمنت از نام آیتم (بدون درخواست سرور)
 *  ۲) پراکسی /api/img/{address} → tonapi (متادیتای واقعی NFT)
 *  ۳) تایل متنی با حرف اول — هیچ‌وقت خالی نمی‌ماند
 */
export function ItemImage({ item, size = 'h-36 w-full' }: { item: { name: string; address?: string; kind?: string; num?: number | null }; size?: string }) {
  const kind = item.kind || 'gifts';
  const primary = kind === 'gifts' ? giftImageFromItemName(item.name) : null;
  const [stage, setStage] = useState(0);
  const [img, setImg] = useState<string | null>(primary);

  const proxy = item.address && !item.address.startsWith('local:') ? `/api/img/${encodeURIComponent(item.address)}` : null;

  if (kind !== 'gifts' && kind !== 'numbers') {
    // یوزرنیم — تایل متنی مثل فرگمنت
    return (
      <div className={`${size} flex items-center justify-center rounded-lg bg-gradient-to-br from-panel2 to-[#0E1826]`}>
        <span className="text-2xl font-black text-accent-hi/80" dir="ltr">@</span>
      </div>
    );
  }

  if (img && stage < 2) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={img}
        alt={item.name}
        className={`${size} rounded-lg bg-panel2 object-contain`}
        loading="lazy"
        onError={() => {
          if (stage === 0 && proxy) {
            setStage(1);
            setImg(proxy);
          } else {
            setStage(2);
          }
        }}
      />
    );
  }

  const label = kind === 'numbers' ? (item.name || '+888').replace(/\+/g, '').slice(0, 3) : (item.name || '?').replace(/#\d+/, '').trim().slice(0, 1) || '؟';
  return (
    <div className={`${size} flex items-center justify-center rounded-lg bg-gradient-to-br from-panel2 to-[#0E1826] text-3xl font-black text-accent-hi/70`}>
      {label}
    </div>
  );
}

/** عکس بزرگ صفحه آیتم — همان زنجیرهٔ فال‌بک */
export function ItemImageLarge({ name, address, kind = 'gifts' }: { name: string; address?: string; kind?: string }) {
  return <ItemImage item={{ name, address, kind }} size="h-72 w-full sm:h-80" />;
}
