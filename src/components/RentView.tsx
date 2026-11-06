'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, KeyRound } from 'lucide-react';
import type { FeedItem, Section } from '@/lib/market';
import { FeedTable } from './FeedTable';
import { TonDiamond } from './ui-bits';
import { fmtTon, faNum, fmtDurationRange, shortAddr } from '@/lib/format';

type RentHistoryRow = {
  nft_address?: string;
  nft_name?: string;
  price_per_day?: string;
  duration?: number;
  end_time?: number;
  ts?: number;
};

const CATS: { key: Section; label: string }[] = [
  { key: 'gifts', label: 'گیفت‌ها' },
  { key: 'usernames', label: 'یوزرنیم‌ها' },
  { key: 'numbers', label: 'شماره‌ها' },
];

/** صفحه اجاره — همان الگوی marketapp.org/rent با ظاهر فرگمنت */
export function RentView() {
  const [cat, setCat] = useState<Section>('gifts');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<RentHistoryRow[]>([]);
  const [myRented, setMyRented] = useState<RentHistoryRow[]>([]);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    // نقاشی فوری از کش جلسه — بدون پرش لودینگ در برگشت‌ها
    const ck = `giftify:rent:${cat}`;
    let painted = false;
    try {
      const raw = sessionStorage.getItem(ck);
      if (raw) {
        const c = JSON.parse(raw);
        if (Array.isArray(c.items) && c.items.length) {
          setItems(c.items);
          setNotice(c.notice || '');
          setLoading(false);
          painted = true;
        }
      }
    } catch { /* کش خراب */ }
    if (!painted) setLoading(true);
    try {
      const r = await fetch(`/api/market/feed?section=${cat}&limit=60`);
      const j = await r.json();
      setItems(j.items || []);
      setNotice(j.notice || '');
      try { sessionStorage.setItem(ck, JSON.stringify({ items: j.items || [], notice: j.notice || '' })); } catch { /* پر */ }
    } catch {
      setNotice('اتصال برقرار نشد — دوباره تلاش کنید');
    } finally {
      setLoading(false);
    }
  }, [cat]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch(`/api/rent/history?category=${cat}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setHistory(j.items || []))
      .catch(() => {});
    fetch('/api/rent/my', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => (j.items ? setMyRented(j.items) : setMyRented([])))
      .catch(() => {});
  }, [cat]);

  const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())) : items;

  return (
    <div>
      <div className="py-6">
        <h1 className="hero-title">اجاره گیفت‌ها، یوزرنیم‌ها و شماره‌ها</h1>
        <p className="hero-sub mt-2">
          گیفت خود را به دیگران اجاره دهید یا خودتان اجاره بگیرید و روی پروفایل تلگرام نمایش دهید. مالکیت دست‌نخورده می‌ماند؛
          مستأجر فقط اجازهٔ «پوشیدن» گیفت روی پروفایل خودش را دارد و امکان انتقال آن به کسی را ندارد.
        </p>
      </div>

      {/* توضیح نحوهٔ کار */}
      <div className="stagger mb-6 grid gap-3 sm:grid-cols-2">
        <div className="card p-4 text-sm leading-7 text-muted">
          <div className="mb-1 font-bold text-ink">اگر اجاره‌دهنده هستید</div>
          گیفت‌هایتان را با پنل مدیریت سایت اجاره‌دار کنید، قیمت هر روز و بازهٔ مدت را مشخص کنید و تراکنش را امضا کنید تا گیفت
          به قرارداد اجاره منتقل شود. مستأجر نمی‌تواند گیفت را جابه‌جا کند.
        </div>
        <div className="card p-4 text-sm leading-7 text-muted">
          <div className="mb-1 font-bold text-ink">اگر اجاره‌گیرنده هستید</div>
          روی ردیف هر آیتم «اجاره کردن» را بزنید، مدت را انتخاب و هزینهٔ دوره را با TON Connect بپردازید. سپس با «اتصال به تلگرام»
          قرارداد اجاره به فرگمنت وصل می‌شود تا گیفت روی پروفایل شما نمایش داده شود.
        </div>
      </div>

      {/* تب‌ها */}
      <div className="mb-4 flex gap-6 border-b border-line">
        {CATS.map((c) => (
          <button key={c.key} className={`tab ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4 max-w-xl">
        <Search size={17} className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pe-11" placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {notice && (
        <div className="mb-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-2.5 text-xs leading-6 text-[#FBBF24]">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card p-2.5">
              <div className="skeleton h-36 w-full" />
              <div className="skeleton mt-2 h-3 w-2/3" />
              <div className="skeleton mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <FeedTable section={cat} items={filtered} />
      )}

      {/* اجاره‌های فعال من */}
      {myRented.length > 0 && (
        <div className="mt-10">
          <h2 className="section-title mb-3">اجاره‌های فعال (کیف پول توکن API)</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ftable min-w-[480px]">
                <thead>
                  <tr><th>آیتم</th><th>قیمت هر روز</th><th>پایان اجاره</th></tr>
                </thead>
                <tbody>
                  {myRented.map((r, i) => (
                    <tr key={i}>
                      <td className="font-bold">{r.nft_name || '—'}</td>
                      <td className="tabular"><TonDiamond className="text-ton" /> {fmtTon(Number(r.price_per_day || 0) / 1e9)} / روز</td>
                      <td className="text-xs text-muted">{r.end_time ? new Date(r.end_time * 1000).toLocaleDateString('fa-IR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* تاریخچه اجاره */}
      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="section-title mb-3">تاریخچه اجاره</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ftable min-w-[480px]">
                <thead>
                  <tr><th>آیتم</th><th>قیمت هر روز</th><th>مدت</th><th>مالک</th></tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i}>
                      <td className="font-bold">{r.nft_name || '—'}</td>
                      <td className="tabular"><TonDiamond className="text-ton" /> {fmtTon(Number(r.price_per_day || 0) / 1e9)}</td>
                      <td className="text-xs text-muted">{r.duration ? fmtDurationRange(r.duration, r.duration) : '—'}</td>
                      <td className="text-xs text-muted" dir="ltr">{shortAddr(r.nft_address)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-xs leading-6 text-muted">
        <KeyRound size={12} className="inline align-[-1px]" /> برای اجاره دادن گیفت‌های خودتان، از{' '}
        <Link href="/admin" className="text-accent-hi hover:underline">پنل مدیریت</Link> لیستینگ اجاره بسازید یا از طریق مالک سایت اقدام کنید.
      </div>
    </div>
  );
}
