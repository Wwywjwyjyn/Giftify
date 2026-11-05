import { GIFT_SLUGS, collectionKeyOf, guessGiftSlugFromName, giftImageUrlFromSlug, giftImageFromItemName, telegramLinkFromItemName } from './giftimg';
import { TONAPI_BASE } from './env';
import { db } from './db';

export { GIFT_SLUGS, collectionKeyOf, guessGiftSlugFromName, giftImageUrlFromSlug, giftImageFromItemName, telegramLinkFromItemName };

/**
 * عکس گیفت‌ها — سه لایه با پوشش کامل (سمت سرور):
 *  1) کش دیتابیس (ImageCache)
 *  2) الگوی واقعی فرگمنت: nft.fragment.com/gift/{slug}-{num}.webp
 *  3) tonapi.io (متادیتای واقعی NFT) — برای هر NFT دیگر
 */

async function cachedImage(address: string): Promise<string | null> {
  try {
    const row = await db.imageCache.findUnique({ where: { address } });
    return row?.url || null;
  } catch {
    return null;
  }
}

async function saveImageCache(address: string, url: string) {
  try {
    await db.imageCache.upsert({
      where: { address },
      update: { url, updatedAt: new Date() },
      create: { address, url },
    });
  } catch {
    /* فقط حافظه */
  }
}

export async function getGiftSlug(collectionAddress: string, collectionName: string): Promise<string | null> {
  const key = `giftslug:${collectionAddress}`;
  const cached = await cachedImage(key);
  if (cached) return cached === '-' ? null : cached;
  return guessGiftSlugFromName(collectionName || '');
}

export async function rememberGiftSlug(collectionAddress: string, slug: string | null) {
  await saveImageCache(collectionAddress, slug || '-');
}

export async function resolveTonapiImage(address: string): Promise<{ image: string | null; slug: string | null }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 9000);
    const res = await fetch(`${TONAPI_BASE}/v2/nfts/${encodeURIComponent(address)}`, {
      signal: ctl.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    clearTimeout(t);
    if (!res.ok) return { image: null, slug: null };
    const j = (await res.json()) as { metadata?: { image?: string } };
    const image = j.metadata?.image || null;
    let slug: string | null = null;
    if (image) {
      const m = image.match(/nft\.fragment\.com\/gift\/([a-z0-9]+?)-\d+\.webp/i);
      if (m) slug = m[1].toLowerCase();
    }
    return { image, slug };
  } catch {
    return { image: null, slug: null };
  }
}

/**
 * عکس یک NFT برای صفحه تک‌آیتم — اول کش، بعد الگوی فرگمنت، آخر tonapi.
 */
export async function resolveImage(opts: {
  address: string;
  kind: 'gift' | 'username' | 'number';
  collectionSlug?: string | null;
  itemNum?: number | null;
}): Promise<string | null> {
  const { address } = opts;
  const cached = await cachedImage(address);
  if (cached && cached !== '-') return cached;
  if (opts.collectionSlug && opts.itemNum) {
    const url = giftImageUrlFromSlug(opts.collectionSlug, opts.itemNum);
    await saveImageCache(address, url);
    return url;
  }
  const r = await resolveTonapiImage(address);
  if (r.image) {
    await saveImageCache(address, r.image);
    return r.image;
  }
  return null;
}
