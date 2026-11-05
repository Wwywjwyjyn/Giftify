import { NextRequest } from 'next/server';
import { getFeed, type Section, type FeedMode } from '@/lib/market';
import { kvGet, kvSet } from '@/lib/kv';
import { resolveTonapiImage, rememberGiftSlug, guessGiftSlugFromName } from '@/lib/images';
import { db } from '@/lib/db';

/** یادگیری slug کالکشن برای ساخت لینک عکس فرگمنت */
async function ensureSlugs(items: { collectionAddress?: string | null; address?: string; collectionSlug?: string | null }[]) {
  const need = new Map<string, string>(); // collection -> nft address نمونه
  for (const it of items) {
    if (it.collectionSlug || !it.collectionAddress || !it.address) continue;
    const key = `giftslug:${it.collectionAddress}`;
    const c = await kvGet<string>(key, 30 * 24 * 3600 * 1000);
    if (c) {
      it.collectionSlug = c === '-' ? null : c;
      continue;
    }
    if (!need.has(it.collectionAddress)) need.set(it.collectionAddress, it.address);
  }
  let lookups = 0;
  for (const [colAddr, nftAddr] of need) {
    if (lookups >= 2) break; // حداکثر ۲ پروب به tonapi در هر درخواست
    lookups++;
    const r = await resolveTonapiImage(nftAddr);
    const slug = r.slug ?? guessGiftSlugFromName('');
    await rememberGiftSlug(colAddr, r.slug);
    await kvSet(`giftslug:${colAddr}`, r.slug ?? '-');
    for (const it of items) {
      if (it.collectionAddress === colAddr && !it.collectionSlug) it.collectionSlug = r.slug;
    }
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const section = (sp.get('section') || 'gifts') as Section;
  const mode = (sp.get('mode') || 'sale') as FeedMode;
  const cursor = sp.get('cursor') || undefined;
  const limit = Math.min(100, Number(sp.get('limit')) || 30);
  const collection = sp.get('collection') || undefined;
  const sort = sp.get('sort') || undefined;

  const result = await getFeed(section, mode, { cursor, limit, collection_address: collection, sort_by: sort });

  // اسلاگ کالکشن‌ها برای عکس‌ها
  if (section === 'gifts') {
    try {
      await ensureSlugs(result.items as never);
    } catch { /* عکس اختیاری است */ }
  }

  return Response.json(result);
}
