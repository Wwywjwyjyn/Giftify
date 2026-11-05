/** لایه داده بازار: کالکشن‌ها، فید اجاره (رایگان)، لیستینگ محلی، اطلاعات آیتم */
import { maFetch, isTokenInvalid, TOKEN_INVALID_FA } from './marketapp';
import { kvGet, kvSet } from './kv';
import { db } from './db';
import { fromNano } from './format';
import type { NFTItem, RentItem, Collection } from './types';

export type Section = 'usernames' | 'numbers' | 'gifts';

export type FeedItem = {
  key: string;
  source: 'marketapp' | 'local';
  kind: Section;
  address?: string;
  name: string;
  sub: string;
  num: number | null;
  collectionSlug?: string | null;
  collectionAddress?: string | null;
  attrs: { trait_type: string; value: string | number }[];
  mode: 'rent' | 'sale'; // مارکت‌اپ: فقط اجاره — لیستینگ محلی: اجاره یا خرید مستقیم از سایت
  priceTon: number | null; // اجاره: مبلغ هر روز — خرید محلی: کل مبلغ
  endTimeSec?: number | null;
  minDurationSec?: number | null;
  maxDurationSec?: number | null;
  owner?: string | null;
  listedAt?: number | null;
};

export type FeedResult = {
  items: FeedItem[];
  cursor: string | null;
  notice?: string;
};

const KIND_DB: Record<Section, string> = { usernames: 'username', numbers: 'number', gifts: 'gift' };

// ---------------- کالکشن‌ها ----------------
export async function getCollections(kind: 'gifts' | 'all', force = false): Promise<Collection[]> {
  const key = `collections:${kind}`;
  if (!force) {
    const c = await kvGet<Collection[]>(key, 5 * 60 * 1000);
    if (c && c.length) return c;
  }
  const r = await maFetch<Collection[]>(kind === 'gifts' ? '/v1/collections/gifts/' : '/v1/collections/');
  if (r.status === 200 && Array.isArray(r.body)) {
    await kvSet(key, JSON.stringify(r.body));
    return r.body;
  }
  const stale = await kvGet<Collection[]>(key, 30 * 24 * 3600 * 1000);
  return stale || [];
}

export async function getSpecialCollections(kind: 'usernames' | 'numbers'): Promise<Collection[]> {
  const all = await getCollections('all');
  const q = kind === 'usernames' ? 'username' : 'number';
  return (all || []).filter((c) => (c.name || '').toLowerCase().includes(q));
}

// ---------------- فید اجاره (endpoint رایگان مارکت‌اپ) ----------------
export async function getRentFeed(
  section: Section,
  params: { cursor?: string; limit?: number; collection_address?: string; model?: string; backdrop?: string; symbol?: string; sort_by?: string } = {},
): Promise<FeedResult> {
  const r = await maFetch<{ cursor: string | null; items: RentItem[] }>(`/v1/rent/${section}/`, { query: params as Record<string, string | number | undefined | null> });
  if (r.status !== 200 || !r.body) {
    if (isTokenInvalid(r.body)) return { items: [], cursor: null, notice: TOKEN_INVALID_FA };
    return { items: [], cursor: null, notice: 'فید اجاره در دسترس نیست' };
  }
  const items: FeedItem[] = (r.body.items || []).map((it) => ({
    key: it.nft_address,
    source: 'marketapp',
    kind: section,
    address: it.nft_address,
    name: it.nft_name,
    sub: section === 'usernames' ? `${it.nft_name.replace(/^@/, '')}.t.me` : '',
    num: it.nft_name.match(/#(\d+)/) ? Number(it.nft_name.match(/#(\d+)/)![1]) : null,
    attrs: it.attributes || [],
    mode: 'rent',
    priceTon: fromNano(it.price_per_day),
    minDurationSec: it.min_duration,
    maxDurationSec: it.max_duration,
    owner: it.owner,
    listedAt: it.listed_at,
  }));
  // ذخیره در RentCache — تا صفحه آیتم و «اجاره کردن» بدون endpoint پولی هم کار کنند
  void saveRentCache(section, r.body.items || []);
  return { items, cursor: r.body.cursor || null };
}

async function saveRentCache(section: Section, items: RentItem[]) {
  try {
    for (const it of items) {
      await db.rentCache.upsert({
        where: { nftAddress: it.nft_address },
        update: {
          kind: section, name: it.nft_name, pricePerDay: fromNano(it.price_per_day),
          minDurationSec: it.min_duration || 86400, maxDurationSec: it.max_duration || 86400,
          owner: it.owner || null, attrs: JSON.stringify(it.attributes || []), listedAt: it.listed_at || null,
        },
        create: {
          nftAddress: it.nft_address, kind: section, name: it.nft_name,
          pricePerDay: fromNano(it.price_per_day), minDurationSec: it.min_duration || 86400,
          maxDurationSec: it.max_duration || 86400, owner: it.owner || null,
          attrs: JSON.stringify(it.attributes || []), listedAt: it.listed_at || null,
        },
      });
    }
  } catch {
    /* کش اختیاری است */
  }
}

/** اطلاعات اجاره یک آیتم از کش — کار بدون پلن پولی */
export async function getRentCached(address: string) {
  try {
    return await db.rentCache.findUnique({ where: { nftAddress: address } });
  } catch {
    return null;
  }
}

// ---------------- لیستینگ‌های محلی سایت (اجاره + خرید مستقیم) ----------------
export async function getLocalListings(section: Section): Promise<FeedItem[]> {
  try {
    const rows = await db.localListing.findMany({
      where: { kind: KIND_DB[section], status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const out: FeedItem[] = [];
    for (const r of rows) {
      if (r.rentPerDayTon) {
        out.push({
          key: `local:${r.id}:rent`,
          source: 'local', kind: section,
          address: `local:${r.id}`,
          name: r.name,
          sub: section === 'usernames' ? `${r.name.replace(/^@/, '')}.t.me` : '',
          num: r.itemNum ?? null,
          collectionSlug: r.collectionSlug || null,
          attrs: [],
          mode: 'rent',
          priceTon: r.rentPerDayTon,
          minDurationSec: (r.rentMinDays ?? 1) * 86400,
          maxDurationSec: (r.rentMaxDays ?? 30) * 86400,
          owner: r.ownerWallet,
          listedAt: Math.floor(r.createdAt.getTime() / 1000),
        });
      }
      if (r.priceTon) {
        out.push({
          key: `local:${r.id}:sale`,
          source: 'local', kind: section,
          address: `local:${r.id}`,
          name: r.name,
          sub: section === 'usernames' ? `${r.name.replace(/^@/, '')}.t.me` : '',
          num: r.itemNum ?? null,
          collectionSlug: r.collectionSlug || null,
          attrs: [],
          mode: 'sale',
          priceTon: r.priceTon,
          owner: r.ownerWallet,
          listedAt: Math.floor(r.createdAt.getTime() / 1000),
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------- فید ترکیبی صفحه بازار (اجاره مارکت‌اپ + لیستینگ محلی) ----------------
export async function getFeed(
  section: Section,
  params: { cursor?: string; limit?: number; collection_address?: string; sort_by?: string } = {},
): Promise<FeedResult> {
  const rent = await getRentFeed(section, params);
  const local = await getLocalListings(section);
  return { ...rent, items: [...local, ...rent.items] };
}

// ---------------- اطلاعات تک آیتم ----------------
export type ItemDetail = {
  ok: boolean;
  paid?: boolean;
  tokenInvalid?: boolean;
  source: 'marketapp' | 'tonapi' | 'rentcache' | 'none';
  name: string;
  address: string;
  collectionAddress?: string;
  collectionName?: string;
  attrs: { trait_type: string; value: string | number }[];
  status?: string;
  details?: {
    priceTon?: number | null;
    currency?: string;
    minBidTon?: number | null;
    maxBidTon?: number | null;
    endTimeSec?: number | null;
    bidStepTon?: number | null;
    pricePerDayTon?: number | null;
    minDurationSec?: number | null;
    maxDurationSec?: number | null;
    discountPd?: number | null;
    rentedBy?: string | null;
    rentEndSec?: number | null;
  };
  owner?: string | null;
};

export async function getItemInfo(address: string): Promise<ItemDetail> {
  const r = await maFetch<{ status: string; status_details: Record<string, unknown>; attributes: { trait_type: string; value: string | number }[]; name: string; collection_address: string; real_owner?: string }>(
    `/v1/nfts/${address}/`,
  );
  if (r.status === 200 && r.body) {
    const sd = r.body.status_details || {};
    const d: ItemDetail['details'] = {};
    if ('price' in sd) d.priceTon = fromNano(sd.price as string);
    if ('currency' in sd) d.currency = String(sd.currency);
    if ('min_bid' in sd) d.minBidTon = fromNano(sd.min_bid as string);
    if ('max_bid' in sd) d.maxBidTon = sd.max_bid ? fromNano(sd.max_bid as string) : null;
    if ('end_time' in sd) d.endTimeSec = (sd.end_time as number) || null;
    if ('bid_step' in sd) d.bidStepTon = sd.bid_step ? Number(sd.bid_step) : null;
    if ('price_per_day' in sd) d.pricePerDayTon = fromNano(sd.price_per_day as string);
    if ('min_duration' in sd) d.minDurationSec = (sd.min_duration as number) || null;
    if ('max_duration' in sd) d.maxDurationSec = (sd.max_duration as number) || null;
    if ('discount_pd' in sd) d.discountPd = (sd.discount_pd as number) ?? null;
    if ('rented_by' in sd) d.rentedBy = (sd.rented_by as string) || null;
    if ('end_time' in sd && r.body.status === 'rented') d.rentEndSec = (sd.end_time as number) || null;
    return {
      ok: true,
      source: 'marketapp',
      name: r.body.name,
      address,
      collectionAddress: r.body.collection_address,
      attrs: r.body.attributes || [],
      status: r.body.status,
      details: d,
      owner: r.body.real_owner || null,
    };
  }

  // فال‌بک ۱: کش اجاره (endpoint رایگان) — حتی وقتی nfts/{addr} پولی است، اجاره کار می‌کند
  const rc = await getRentCached(address);
  if (rc) {
    const attrs = JSON.parse(rc.attrs || '[]') as { trait_type: string; value: string | number }[];
    return {
      ok: true,
      source: 'rentcache',
      name: rc.name,
      address,
      attrs,
      status: 'for_rent',
      details: {
        pricePerDayTon: rc.pricePerDay,
        minDurationSec: rc.minDurationSec,
        maxDurationSec: rc.maxDurationSec,
      },
      owner: rc.owner,
    };
  }

  // فال‌بک ۲: tonapi (رایگان و همیشه فعال)
  try {
    const res = await fetch(`https://tonapi.io/v2/nfts/${encodeURIComponent(address)}`, { cache: 'no-store' });
    if (res.ok) {
      const j = (await res.json()) as {
        metadata?: { name?: string; attributes?: { trait_type: string; value: string }[] };
        collection?: { name?: string; address?: string };
        owner?: { address?: string };
        sale?: { price?: { value?: string } | string };
      };
      const salePrice = j.sale?.price ? fromNano(typeof j.sale.price === 'object' ? (j.sale.price.value || '0') : j.sale.price) : null;
      return {
        ok: true,
        source: 'tonapi',
        name: j.metadata?.name || 'NFT',
        address,
        collectionAddress: j.collection?.address,
        collectionName: j.collection?.name,
        attrs: j.metadata?.attributes || [],
        status: j.sale ? 'for_sale' : 'not_for_sale',
        details: salePrice ? { priceTon: salePrice, currency: 'TON' } : {},
        owner: j.owner?.address || null,
      };
    }
  } catch {
    /* ادامه */
  }
  const paid = r.status === 402;
  return { ok: false, paid, tokenInvalid: isTokenInvalid(r.body), source: 'none', name: '', address, attrs: [] };
}
