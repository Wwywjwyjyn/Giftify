'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, LayoutGrid, Table2, ChevronDown } from 'lucide-react';
import type { FeedItem, Section } from '@/lib/market';
import { FeedTable, ItemCount } from './FeedTable';
import { GiftGrid } from './GiftGrid';
import { fmtTon } from '@/lib/format';

type Col = { name: string; address: string; extra_data?: { floor?: string | null; rent_floor?: string | null; items?: number | null } };

const SORTS: { value: string; label: string }[] = [
  { value: 'recently_touch', label: 'جدیدترین' },
  { value: 'price_per_day', label: 'ارزان‌ترین روزانه' },
  { value: 'min_price', label: 'ارزان‌ترین کل' },
  { value: 'duration_asc', label: 'کوتاه‌ترین مدت' },
  { value: 'duration_desc', label: 'بلندترین مدت' },
  { value: 'item_num_asc', label: 'شماره صعودی' },
  { value: 'item_num_desc', label: 'شماره نزولی' },
];

/**
 * نمای بازار — نظم فرگمنت:
 * هیرو + جستجوی فراگیر (آدرس/@آیدی/کانال/نام) → صفحه /search
 * فیلترها: کالکشن، مرتب‌سازی، بازه قیمت، بازه شماره + فیلتر سریع سمت کلاینت
 */
export function MarketView(props: {
  section: Section;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  listTitle: string;
  showCollections?: boolean;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [heroQ, setHeroQ] = useState('');
  const [sort, setSort] = useState(sp.get('sort') || 'recently_touch');
  const [col, setCol] = useState(sp.get('col') || '');
  const [minPrice, setMinPrice] = useState(sp.get('min') || '');
  const [maxPrice, setMaxPrice] = useState(sp.get('max') || '');
  const [numFrom, setNumFrom] = useState(sp.get('nf') || '');
  const [numTo, setNumTo] = useState(sp.get('nt') || '');
  const [view, setView] = useState<'table' | 'grid'>(props.section === 'gifts' ? 'grid' : 'table');
  const [cols, setCols] = useState<Col[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);

  const section = props.section;

  useEffect(() => {
    const kind = section;
    fetch(`/api/market/collections?kind=${kind}`)
      .then((r) => r.json())
      .then((j) => setCols(j.collections || []))
      .catch(() => {});
  }, [section]);

  const load = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      if (replace) setLoading(true);
      else setMore(true);
      try {
        const ps = new URLSearchParams({ section, limit: '50' });
        if (nextCursor) ps.set('cursor', nextCursor);
        if (col) ps.set('collection', col);
        if (sort && sort !== 'recently_touch') ps.set('sort', sort);
        const r = await fetch(`/api/market/feed?${ps.toString()}`, { cache: 'no-store' });
        const j = await r.json();
        setNotice(j.notice || '');
        setCursor(j.cursor || null);
        setItems((prev) => (replace ? j.items || [] : [...prev, ...(j.items || [])]));
      } catch {
        setNotice('خطا در دریافت داده');
      } finally {
        setLoading(false);
        setMore(false);
      }
    },
    [section, col, sort],
  );

  useEffect(() => {
    load(null, true);
  }, [load]);

  // فیلتر سمت کلاینت: فیلتر سریع، بازه قیمت، بازه شماره
  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    const min = parseFloat(minPrice) || null;
    const max = parseFloat(maxPrice) || null;
    const nf = numFrom ? Number(numFrom) : null;
    const nt = numTo ? Number(numTo) : null;
    return items.filter((it) => {
      if (qn && !it.name.toLowerCase().includes(qn) && !it.sub.toLowerCase().includes(qn)) return false;
      const p = it.priceTon ?? 0;
      if (min !== null && p < min) return false;
      if (max !== null && p > max) return false;
      if ((nf !== null || nt !== null) && it.num !== null) {
        if (nf !== null && it.num < nf) return false;
        if (nt !== null && it.num > nt) return false;
      }
      return true;
    });
  }, [items, q, minPrice, maxPrice, numFrom, numTo]);

  function setParam(k: string, v: string) {
    const ps = new URLSearchParams(sp.toString());
    if (v) ps.set(k, v);
    else ps.delete(k);
    router.replace(`?${ps.toString()}`, { scroll: false });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const t = heroQ.trim();
    if (t) router.push(`/search?q=${encodeURIComponent(t)}`);
  }

  return (
    <div>
      {/* هیرو مثل فرگمنت */}
      <div className="py-6">
        <h1 className="hero-title">{props.title}</h1>
        <p className="hero-sub mt-2">{props.subtitle}</p>
        <form onSubmit={submitSearch} className="relative mx-auto mt-5 max-w-2xl">
          <Search size={17} className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pe-11"
            placeholder={props.searchPlaceholder}
            value={heroQ}
            onChange={(e) => setHeroQ(e.target.value)}
            aria-label="جستجوی فراگیر"
          />
        </form>
        <p className="mt-2 text-center text-[11px] leading-5 text-muted">
          جستجوی آیدی و کانال تلگرام، آدرس NFT، کالکشن یا شماره — نتیجه در صفحهٔ نتایج باز می‌شود
        </p>
      </div>

      {/* نوار فیلتر — نظم فرگمنت */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(props.showCollections || section === 'gifts') && cols.length > 0 && (
          <div className="relative">
            <select
              className="input w-auto py-2 pe-9 text-xs"
              value={col}
              onChange={(e) => {
                setCol(e.target.value);
                setParam('col', e.target.value);
              }}
              aria-label="کالکشن"
            >
              <option value="">همه کالکشن‌ها</option>
              {cols.map((c) => (
                <option key={c.address} value={c.address}>
                  {c.name}
                  {c.extra_data?.rent_floor ? ` — کف اجاره ${fmtTon(Number(c.extra_data.rent_floor) / 1e9, 2)}` : c.extra_data?.floor ? ` — کف ${fmtTon(Number(c.extra_data.floor) / 1e9, 2)}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        )}

        <div className="relative">
          <select
            className="input w-auto py-2 pe-9 text-xs"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setParam('sort', e.target.value);
            }}
            aria-label="مرتب‌سازی"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted" />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <input className="input w-24 py-2" placeholder="از قیمت" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} inputMode="decimal" aria-label="از قیمت" />
          <span className="text-muted">—</span>
          <input className="input w-24 py-2" placeholder="تا قیمت" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} inputMode="decimal" aria-label="تا قیمت" />
        </div>

        {section === 'gifts' && (
          <div className="flex items-center gap-1.5 text-xs">
            <input className="input w-24 py-2" placeholder="از شماره" value={numFrom} onChange={(e) => setNumFrom(e.target.value)} inputMode="numeric" aria-label="از شماره" />
            <span className="text-muted">—</span>
            <input className="input w-24 py-2" placeholder="تا شماره" value={numTo} onChange={(e) => setNumTo(e.target.value)} inputMode="numeric" aria-label="تا شماره" />
          </div>
        )}

        <input
          className="input w-40 py-2 text-xs"
          placeholder="فیلتر سریع…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="فیلتر سریع"
        />

        <div className="ms-auto flex rounded-lg border border-line bg-panel p-1">
          <button className={`rounded-md p-1.5 ${view === 'table' ? 'bg-accent text-white' : 'text-muted'}`} onClick={() => setView('table')} aria-label="نمای جدول">
            <Table2 size={14} />
          </button>
          <button className={`rounded-md p-1.5 ${view === 'grid' ? 'bg-accent text-white' : 'text-muted'}`} onClick={() => setView('grid')} aria-label="نمای کارت">
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* عنوان بخش + شمارنده */}
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="section-title">{props.listTitle}</h2>
        <ItemCount n={filtered.length} />
      </div>

      {notice && (
        <div className="mb-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-2.5 text-xs leading-6 text-[#FBBF24]">{notice}</div>
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
      ) : view === 'table' ? (
        <FeedTable section={section} items={filtered} />
      ) : (
        <GiftGrid items={filtered} />
      )}

      {cursor && !loading && (
        <div className="mt-4 text-center">
          <button className="btn-ghost" onClick={() => load(cursor, false)} disabled={more}>
            {more ? 'در حال بارگذاری…' : 'نمایش بیشتر'}
          </button>
        </div>
      )}
    </div>
  );
}
