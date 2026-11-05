'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, ExternalLink, Users, KeyRound } from 'lucide-react';
import { fmtTon, fmtDurationRange } from '@/lib/format';
import { TonDiamond, StatusPill } from './ui-bits';
import { ItemImage } from './ItemImage';

type Row = {
  address?: string;
  name: string;
  sub?: string;
  num?: number | null;
  priceTon?: number | null;
  minDurationSec?: number | null;
  maxDurationSec?: number | null;
  source?: string;
  mode?: string;
};

type Result = {
  q: string;
  empty?: boolean;
  notice?: string;
  nft: { ok: boolean; name?: string; address: string; status?: string; pricePerDayTon?: number | null; paid?: boolean } | null;
  channel: { name: string; exists: boolean; title: string; description: string; image: string; members: string; link: string } | null;
  usernames: Row[];
  numbers: Row[];
  gifts: Row[];
  collections: { name: string; address: string; items?: number | null; rentFloorTon?: number | null; floorTon?: number | null }[];
};

const HEADERS = { 'cache-control': 'no-store' } as const;

export function SearchView() {
  const sp = useSearchParams();
  const q0 = sp.get('q') || '';
  const [q, setQ] = useState(q0);
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { headers: HEADERS, cache: 'no-store' });
      setRes(await r.json());
    } catch {
      setRes({ q: term, notice: 'خطا در جستجو', nft: null, channel: null, usernames: [], numbers: [], gifts: [], collections: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (q0) void run(q0);
  }, [q0, run]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (t) window.history.replaceState(null, '', `/search?q=${encodeURIComponent(t)}`);
    void run(t);
  }

  const hasAny = !!(res && (res.channel?.exists || res.nft || res.gifts.length || res.usernames.length || res.numbers.length || res.collections.length));

  return (
    <div className="py-4">
      <h1 className="hero-title">جستجو</h1>
      <p className="hero-sub mt-2 mb-4">
        آیدی یا کانال تلگرام (@آیدی، t.me/کانال)، آدرس NFT، نام کالکشن یا گیفت، شمارهٔ کلکسیونی +888 را جستجو کنید
      </p>

      <form onSubmit={submit} className="relative mx-auto mb-8 max-w-2xl">
        <Search size={17} className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pe-11" placeholder="مثلاً: durov / t.me/giftify / EQA… / Plush Pepe / +888…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجو" />
      </form>

      {loading && <div className="flex justify-center py-14"><span className="spin" /></div>}

      {res && !loading && (
        <div className="space-y-8">
          {res.notice && (
            <div className="rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-2.5 text-xs leading-6 text-[#FBBF24]">{res.notice}</div>
          )}

          {!hasAny && !res.notice && (
            <div className="card p-10 text-center text-sm text-muted">چیزی برای «{res.q}» پیدا نشد</div>
          )}

          {/* کانال/آیدی تلگرام */}
          {res.channel && (
            <section>
              <h2 className="section-title mb-3">آیدی / کانال تلگرام</h2>
              {res.channel.exists ? (
                <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  {res.channel.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={res.channel.image} alt={res.channel.title} className="h-16 w-16 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-panel2 text-xl font-black text-accent-hi">@</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold">{res.channel.title || `@${res.channel.name}`}</span>
                      <span className="chip" dir="ltr">@{res.channel.name}</span>
                      {res.channel.members && (
                        <span className="chip"><Users size={12} /> {res.channel.members}</span>
                      )}
                    </div>
                    {res.channel.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{res.channel.description}</p>}
                  </div>
                  <a href={res.channel.link} target="_blank" rel="noreferrer" className="btn-ghost btn-sm shrink-0">
                    <ExternalLink size={13} /> باز در تلگرام
                  </a>
                </div>
              ) : (
                <div className="card p-4 text-sm text-muted">
                  صفحهٔ عمومی برای <span dir="ltr" className="font-bold">@{res.channel.name}</span> پیدا نشد — این آیدی هنوز کانال/پروفایل عمومی ندارد.
                </div>
              )}
            </section>
          )}

          {/* NFT با آدرس */}
          {res.nft && (
            <section>
              <h2 className="section-title mb-3">NFT</h2>
              <div className="card p-4">
                {res.nft.ok && res.nft.name ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold">{res.nft.name}</div>
                      <div className="mt-0.5 text-xs text-muted" dir="ltr">{res.nft.address.slice(0, 14)}…</div>
                    </div>
                    <Link href={`/item/${res.nft.address}`} className="btn-primary btn-sm">مشاهده و اجاره</Link>
                  </div>
                ) : res.nft.paid ? (
                  <div className="text-xs leading-6 text-muted">نمایش این NFT نیازمند پلن API است — بعد از فعال‌سازی پلن در marketapp.org/api-token خودکار کامل می‌شود.</div>
                ) : (
                  <div className="text-sm text-muted">این آدرس NFT پیدا نشد یا مالکش اجاره‌اش نگذاشته است.</div>
                )}
              </div>
            </section>
          )}

          {/* کالکشن‌ها */}
          {res.collections.length > 0 && (
            <section>
              <h2 className="section-title mb-3">کالکشن‌ها</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {res.collections.map((c) => (
                  <Link key={c.address} href={`/gifts?col=${c.address}`} className="card p-4 transition-colors" style={{ transitionProperty: 'border-color' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{c.name}</span>
                      <span className="chip tabular">{c.items != null ? `${c.items} آیتم` : '—'}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted tabular">
                      {c.rentFloorTon != null && <>کف اجاره: <TonDiamond className="text-ton" /> {fmtTon(c.rentFloorTon)}</>}
                      {c.rentFloorTon == null && c.floorTon != null && <>کف: <TonDiamond className="text-ton" /> {fmtTon(c.floorTon)}</>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* گیفت‌ها */}
          {res.gifts.length > 0 && (
            <section>
              <h2 className="section-title mb-3">گیفت‌ها</h2>
              <div className="card divide-y divide-line">
                {res.gifts.map((g) => (
                  <RowLine key={g.address} r={g} kind="gifts" />
                ))}
              </div>
            </section>
          )}

          {/* یوزرنیم‌ها */}
          {res.usernames.length > 0 && (
            <section>
              <h2 className="section-title mb-3">یوزرنیم‌های اجاره‌دار</h2>
              <div className="card divide-y divide-line">
                {res.usernames.map((u) => (
                  <RowLine key={u.address} r={u} kind="usernames" />
                ))}
              </div>
            </section>
          )}

          {/* شماره‌ها */}
          {res.numbers.length > 0 && (
            <section>
              <h2 className="section-title mb-3">شماره‌های کلکسیونی</h2>
              <div className="card divide-y divide-line">
                {res.numbers.map((n) => (
                  <RowLine key={n.address} r={n} kind="numbers" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function RowLine({ r, kind }: { r: Row; kind: 'gifts' | 'usernames' | 'numbers' }) {
  return (
    <Link href={`/item/${r.address}`} className="flex items-center gap-3 px-4 py-3">
      <ItemImage item={{ name: r.name, address: r.address, kind }} size="h-11 w-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{r.name}</div>
        {r.sub && <div className="truncate text-xs text-accent-hi" dir="ltr">{r.sub}</div>}
      </div>
      <div className="shrink-0 text-end">
        <div className="text-sm font-bold tabular">
          <TonDiamond className="text-ton" /> {fmtTon(r.priceTon ?? 0)} <span className="text-xs font-normal text-muted">/ روز</span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted">
          {fmtDurationRange(r.minDurationSec ?? 86400, r.maxDurationSec ?? 86400)}
        </div>
      </div>
      <span className="btn-rent btn-sm shrink-0"><KeyRound size={12} /> اجاره</span>
      <StatusPill kind="rent" />
    </Link>
  );
}
