'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Zap, Star } from 'lucide-react';

/** صفحه استارز — دو کارت بزرگ مثل فرگمنت */
export default function StarsPage() {
  const [siteName, setSiteName] = useState('گیفتیفای');
  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((j) => setSiteName(j.site_name || 'گیفتیفای')).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-5 py-8">
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          <Star size={64} className="fill-[#2EA6FF] text-[#2EA6FF]" />
        </div>
        <h1 className="hero-title">تلگرام استارز</h1>
        <p className="hero-sub mt-2">موجودی استارز خودتان یا دوستانتان را شارژ کنید — با قیمت لحظه‌ای و پرداخت TON.</p>
        <Link href="/stars/buy" className="btn-primary mt-5 w-full py-3">خرید بسته استارز</Link>
      </div>

      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          <Zap size={64} className="fill-[#2EA6FF] text-[#2EA6FF]" />
        </div>
        <h1 className="hero-title">گیوِی استارز</h1>
        <p className="hero-sub mt-2">
          کانال تلگرام خود را بوست کنید؛ با هدیه‌دادن استارز به مشترکان، گیوِی برگزار کنید.
        </p>
        <Link href="/giveaway?type=stars" className="btn-primary mt-5 w-full py-3">پیش‌پرداخت گیوِی</Link>
      </div>

      <p className="text-center text-xs text-muted">
        خریدها از طریق {siteName} با اتصال به سرویس رسمی فرگمنت انجام می‌شود و قیمت‌ها لحظه‌ای است.
      </p>
    </div>
  );
}
