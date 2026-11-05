import { NextRequest } from 'next/server';
import { maFetch, isTokenInvalid, TOKEN_INVALID_FA } from '@/lib/marketapp';
import { getRentFeed, getCollections, type FeedItem, type Section } from '@/lib/market';
import { fromNano } from '@/lib/format';

/** ردیف فید → فرمت سبک برای جستجو */
function row(it: FeedItem) {
  return {
    address: it.address,
    name: it.name,
    sub: it.sub,
    num: it.num,
    priceTon: it.priceTon,
    minDurationSec: it.minDurationSec,
    maxDurationSec: it.maxDurationSec,
    attrs: it.attrs,
    source: it.source,
    mode: it.mode,
  };
}

export type SearchRow = ReturnType<typeof row>;

export type ChannelInfo = {
  name: string;
  exists: boolean;
  title: string;
  description: string;
  image: string;
  members: string;
  link: string;
};

const isTonAddress = (s: string) => /^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(s);
const qn = (s: string) => s.toLowerCase().replace(/[\s()']/g, '');

/** اطلاعات کانال/آیدی تلگرام از t.me — «سرچ آیدی و کانال» */
async function fetchTelegramPage(name: string): Promise<ChannelInfo> {
  const out: ChannelInfo = { name, exists: false, title: '', description: '', image: '', members: '', link: `https://t.me/${name}` };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(`https://t.me/${name}`, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GiftifyBot/1.0)', 'Accept-Language': 'en' },
      cache: 'no-store',
    });
    clearTimeout(t);
    if (!res.ok) return out;
    const html = await res.text();
    const pick = (re: RegExp) => {
      const m = html.match(re);
      return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
    };
    const title = pick(/<meta property="og:title" content="([^"]*)"/i);
    out.description = pick(/<meta property="og:description" content="([^"]*)"/i);
    out.image = pick(/<meta property="og:image" content="([^"]*)"/i);
    out.members = pick(/class="tgme_page_extra">([^<]*)</i);
    if (title && !/^Telegram: Contact/i.test(title)) {
      out.exists = true;
      out.title = title;
    }
    return out;
  } catch {
    return out;
  }
}

async function rentFeed(section: Section, limit = 200) {
  return getRentFeed(section, { limit });
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!q) return Response.json({ empty: true, q });

  const result: {
    q: string;
    empty?: boolean;
    notice?: string;
    nft: { ok: boolean; name?: string; address: string; status?: string; attrs?: { trait_type: string; value: string | number }[]; pricePerDayTon?: number | null; paid?: boolean } | null;
    channel: ChannelInfo | null;
    usernames: SearchRow[];
    numbers: SearchRow[];
    gifts: SearchRow[];
    collections: { name: string; address: string; items?: number | null; rentFloorTon?: number | null; floorTon?: number | null }[];
  } = { q, nft: null, channel: null, usernames: [], numbers: [], gifts: [], collections: [] };

  // ۱) آدرس NFT روی TON
  const raw = q.replace(/^ton:\/\//i, '').trim();
  if (isTonAddress(raw) || isTonAddress(q)) {
    const addr = isTonAddress(raw) ? raw : q;
    const r = await maFetch<{ status: string; name: string; attributes: { trait_type: string; value: string | number }[]; status_details: Record<string, unknown> }>(`/v1/nfts/${addr}/`);
    if (r.status === 200 && r.body) {
      const sd = r.body.status_details || {};
      result.nft = {
        ok: true,
        name: r.body.name,
        address: addr,
        status: r.body.status,
        attrs: r.body.attributes || [],
        pricePerDayTon: 'price_per_day' in sd ? fromNano(sd.price_per_day as string) : null,
      };
    } else if (isTokenInvalid(r.body)) {
      result.notice = TOKEN_INVALID_FA;
    } else if (r.status === 402) {
      result.nft = { ok: true, address: addr, paid: true };
    } else {
      result.nft = { ok: false, address: addr };
    }
    return Response.json(result);
  }

  // ۲) آیدی/کانال تلگرام — @name / t.me/name / name.t.me
  const uname = q
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?t\.me\//i, '')
    .replace(/^(www\.)?telegram\.me\//i, '')
    .replace(/\.t\.me$/i, '')
    .replace(/^@/, '')
    .trim()
    .split(/[\s/?]/)[0]
    .replace(/[^A-Za-z0-9_]/g, '');

  const looksLikeUsername = uname.length >= 2 && /^[A-Za-z0-9_]+$/.test(uname) && !/^\d{9,}$/.test(uname);
  const numQ = q.replace(/[+\s-]/g, '');
  const numLike = /^\+?888[\d\s-]{8,}$/.test(q.replace(/\s+/g, ' ')) || /^888\d{4,}$/.test(numQ);

  const jobs: Promise<unknown>[] = [];

  if (looksLikeUsername) {
    jobs.push(fetchTelegramPage(uname).then((c) => (result.channel = c)));
  }

  // اجارهٔ یوزرنیم‌ها — تطابق دقیق آیدی یا شامل عبارت
  jobs.push(
    rentFeed('usernames')
      .then((r) => {
        result.usernames = r.items
          .filter((i) => {
            const bare = i.name.toLowerCase().replace(/^@/, '');
            return (looksLikeUsername && bare === uname.toLowerCase()) || bare.includes(qn(q)) || qn(q).includes(bare);
          })
          .slice(0, 20)
          .map(row);
      })
      .catch(() => {}),
  );

  // شماره‌های کلکسیونی
  jobs.push(
    rentFeed('numbers', 150)
      .then((r) => {
        result.numbers = r.items
          .filter((i) => (numLike && i.name.replace(/[\s-]/g, '').includes(numQ)) || i.name.replace(/[\s-]/g, '').includes(numQ) || i.name.includes(qn(q)))
          .slice(0, 12)
          .map(row);
      })
      .catch(() => {}),
  );

  // گیفت‌ها بر اساس نام
  jobs.push(
    rentFeed('gifts')
      .then((r) => {
        result.gifts = r.items
          .filter((i) => i.name.toLowerCase().includes(qn(q)) || qn(i.name).includes(qn(q)))
          .slice(0, 24)
          .map(row);
      })
      .catch(() => {}),
  );

  // کالکشن‌های گیفت مطابق نام
  jobs.push(
    getCollections('gifts')
      .then((cols) => {
        result.collections = (cols || [])
          .filter((c) => (c.name || '').toLowerCase().includes(qn(q)))
          .slice(0, 10)
          .map((c) => ({
            name: c.name,
            address: c.address,
            items: c.extra_data?.items ?? null,
            rentFloorTon: c.extra_data?.rent_floor ? fromNano(c.extra_data.rent_floor) : null,
            floorTon: c.extra_data?.floor ? fromNano(c.extra_data.floor) : null,
          }));
      })
      .catch(() => {}),
  );

  await Promise.allSettled(jobs);

  // اعلان توکن — فقط اگر هیچ فیدی داده برنگرداند
  if (!result.gifts.length && !result.usernames.length && !result.numbers.length && !result.collections.length) {
    const probe = await maFetch('/v1/rent/gifts/', { query: { limit: 1 } });
    if (isTokenInvalid(probe.body)) result.notice = TOKEN_INVALID_FA;
  }
  return Response.json(result);
}
