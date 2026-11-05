import { NextRequest } from 'next/server';
import { getFeed, type Section } from '@/lib/market';

/**
 * فید بازار = اجارهٔ رایگان مارکت‌اپ + لیستینگ‌های محلی سایت.
 * عکس گیفت‌ها سمت کلاینت از الگوی فرگمنت ساخته می‌شود (بدون درخواست اضافه).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const section = (sp.get('section') || 'gifts') as Section;
  const cursor = sp.get('cursor') || undefined;
  const limit = Math.min(100, Number(sp.get('limit')) || 50);
  const collection = sp.get('collection') || undefined;
  const sort = sp.get('sort') || undefined;

  const result = await getFeed(section, { cursor, limit, collection_address: collection, sort_by: sort });
  return Response.json(result);
}
