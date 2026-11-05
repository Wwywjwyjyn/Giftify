/** لایه داده بازار: کالکشن‌ها، فید فروش/اجاره، اطلاعات آیتم — با فال‌بک هوشمند */
import { maFetch, isPaidRequired, isTokenInvalid, TOKEN_INVALID_FA } from './marketapp';
import { kvGet, kvSet } from './kv';
import { db } from './db';
import { fromNano } from './format';
import type { NFTItem, RentItem, Collection } from './types';

export type Section = 'usernames' | 'numbers' | 'gifts';
export type FeedMode = 'sale' | 'rent';

export type FeedItem = {
  key: string;
  source: 'marketapp' | 'local';
  kind: Section;
  address?: string; // اگر local باشد undefined
  name: string;
  sub: string;
  num: number | null;
  collectionSlug?: string | null;
  collectionAddress?: string | null;
  attrs: { trait_type: string; value: string | number }[];
  mode: FeedMode;
  priceTon: number | null; // فروش: کل مبلغ — اجاره: مبلغ هر روز
  minBidTon?: number | null;
  maxBidTon?: number | null;
  endTimeSec?: number | null;
  minDurationSec?: number | null;
  maxDurationSec?: number | null;
  owner?: string | null;
  sellableDuringRent?: boolean;
  listedAt?: number | null;
};

export type FeedResult = {
  items: FeedItem[];
  cursor: string | null;
  paid: boolean; // فید فروش نیازمند پلن API است؟
  notice?: string;
};

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

// ---------------- فید اجاره (رایگان) ----------------
export async function getRentFeed(
  section: Section,
  params: { cursor?: string; limit?: number; collection_address?: string; model?: string; backdrop?: string; symbol?: string; sort_by?: string } = {},
): Promise<FeedResult> {
  const r = await maFetch<{ cursor: string | null; items: RentItem[] }>(`/v1/rent/${section}/`, { query: params as Record<string, string | number | undefined | null> });
  if (r.status !== 200 || !r.body) {
    if (isTokenInvalid(r.body)) return { items: [], cursor: null, paid: false, notice: TOKEN_INVALID_FA };
    return { items: [], cursor: null, paid: isPaidRequired(r.status, r.body), notice: 'فید اجاره در دسترس نیست' };
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
    sellableDuringRent: it.is_sellable_during_rent,
    listedAt: it.listed_at,
  }));
  return { items, cursor: r.body.cursor || null, paid: false };
}

// ---------------- فید فروش (نیازمند پلن API؛ خطای 402 → فال‌بک) ----------------
export async function getSaleFeed(
  section: Section,
  params: { cursor?: string; limit?: number; collection_address?: string; sort_by?: string } = {},
): Promise<FeedResult> {
  let res: { status: number; body: { cursor?: string | null; items?: NFTItem[] } | null };
  if (section === 'gifts') {
    res = await maFetch('/v1/gifts/onsale/', { query: params as Record<string, string | number | undefined | null> });
  } else {
    const cols = await getSpecialCollections(section);
    const addr = params.collection_address || cols[0]?.address;
    if (!addr) {
      // علت را شفاف بگویید: توکن نامعتبر یا کالکشن ثبت‌نشده
      const probe = await maFetch('/v1/collections/');
      if (isTokenInvalid(probe.body)) return { items: [], cursor: null, paid: false, notice: TOKEN_INVALID_FA };
      return { items: [], cursor: null, paid: false, notice: 'کالکشن یوزرنیم/شماره در مارکت‌اپ یافت نشد' };
    }
    res = await maFetch(`/v1/nfts/collections/${addr}/`, { query: { ...params, filter_by: "onsale" } as Record<string, string | number | undefined | null> });
  }
  if (res.status !== 200 || !res.body?.items) {
    if (isTokenInvalid(res.body)) return { items: [], cursor: null, paid: false, notice: TOKEN_INVALID_FA };
    const paid = isPaidRequired(res.status, res.body);
    return { items: [], cursor: null, paid, notice: paid ? 'فید فروش نیازمند پلن API مارکت‌اپ است — فید اجاره نمایش داده می‌شود' : 'فید فروش موقتاً در دسترس نیست' };
  }
  const items: FeedItem[] = (res.body.items || []).map((it) => {
    const minBid = fromNano(it.min_bid);
    const maxBid = it.max_bid ? fromNano(it.max_bid) : null;
    return {
      key: it.address,
      source: 'marketapp',
      kind: section,
      address: it.address,
      name: it.name,
      sub: section === 'usernames' ? `${it.name.replace(/^@/, '')}.t.me` : '',
      num: it.item_num ?? (it.name.match(/#(\d+)/) ? Number(it.name.match(/#(\d+)/)![1]) : null),
      collectionAddress: it.collection_address,
      attrs: it.attributes || [],
      mode: 'sale',
      priceTon: minBid,
      minBidTon: minBid,
      maxBidTon: maxBid,
      owner: it.real_owner || it.owner || null,
      listedAt: it.listed_at ?? null,
    } as FeedItem;
  });
  return { items, cursor: (res.body as { cursor?: string }).cursor || null, paid: false };
}

// ---------------- لیستینگ‌های محلی سایت ----------------
export async function getLocalListings(section: Section, mode: FeedMode): Promise<FeedItem[]> {
  try {
    const rows = await db.localListing.findMany({
      where: { kind: section === 'usernames' ? 'username' : section === 'numbers' ? 'number' : 'gift', status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows
      .filter((r) => (mode === 'rent' ? !!r.rentPerDayTon : !!r.priceTon))
      .map((r) => ({
        key: `local:${r.id}`,
        source: 'local',
        kind: section,
        name: r.name,
        sub: section === 'usernames' ? `${r.name.replace(/^@/, '')}.t.me` : '',
        num: r.itemNum ?? null,
        collectionSlug: r.collectionSlug || null,
        attrs: [],
        mode,
        priceTon: mode === 'rent' ? r.rentPerDayTon : r.priceTon,
        minDurationSec: r.rentMinDays ? r.rentMinDays * 86400 : null,
        maxDurationSec: r.rentMaxDays ? r.rentMaxDays * 86400 : null,
        owner: r.ownerWallet,
      } as FeedItem));
  } catch {
    return [];
  }
}

// ---------------- فید ترکیبی (فروش → فال‌بک اجاره → لیستینگ محلی) ----------------
export async function getFeed(
  section: Section,
  mode: FeedMode,
  params: { cursor?: string; limit?: number; collection_address?: string; sort_by?: string } = {},
): Promise<FeedResult> {
  let result: FeedResult;
  if (mode === 'sale') {
    result = await getSaleFeed(section, params);
    if (result.paid) {
      const rent = await getRentFeed(section, { ...params, sort_by: params.sort_by || 'price_per_day' });
      const local = await getLocalListings(section, 'sale');
      const localRent = await getLocalListings(section, 'rent');
      result = { items: [...local, ...rent.items, ...localRent], cursor: rent.cursor, paid: true, notice: result.notice };
    } else {
      result = { ...result, items: [...(await getLocalListings(section, 'sale')), ...result.items] };
    }
  } else {
    const rent = await getRentFeed(section, params);
    const local = await getLocalListings(section, 'rent');
    result = { ...rent, items: [...local, ...rent.items] };
  }
  return result;
}

// ---------------- اطلاعات تک آیتم ----------------
export type ItemDetail = {
  ok: boolean;
  paid?: boolean;
  tokenInvalid?: boolean;
  source: 'marketapp' | 'tonapi' | 'none';
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
    if ('end_time' in sd && (r.body.status === 'rented')) d.rentEndSec = (sd.end_time as number) || null;
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

  // فال‌بک: tonapi (رایگان و همیشه فعال)
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
  const paid = isPaidRequired(r.status, r.body);
  return { ok: false, paid, tokenInvalid: isTokenInvalid(r.body), source: 'none', name: '', address, attrs: [] };
}
