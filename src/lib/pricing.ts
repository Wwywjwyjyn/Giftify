/**
 * قیمت‌گذاری استارز و پرمیوم — زنجیرهٔ منبع:
 *  ۱) مارکت‌اپ (قیمت لحظه‌ای واقعی فرگمنت — وقتی توکن معتبر است)
 *  ۲) قیمت‌های تنظیم‌شدهٔ ادمین در پنل (مدل فروشگاهی — با حاشیهٔ خودش)
 *  ۳) پیش‌فرض‌های واقعی ثبت‌شده از آخرین دادهٔ زندهٔ API
 */
import { maFetch, isTokenInvalid } from './marketapp';
import { getSettings } from './settings';
import { memGet, memSet } from './kv';

export type StarsPrice = { ton: number; source: 'marketapp' | 'admin' | 'default' };

/** قیمت استارز به TON برای تعداد دلخواه (کش ۹۰ ثانیه) */
export async function getStarsPriceTon(quantity: number): Promise<StarsPrice | null> {
  const qty = Math.max(50, Math.min(10_000_000, Math.floor(quantity || 0)));
  if (!qty) return null;
  const key = `starsprice:${qty}`;
  const m = memGet<StarsPrice>(key, 90_000);
  if (m) return m;

  // ۱) مارکت‌اپ
  const r = await maFetch<{ ton?: number | string; price?: number | string }>(`/v1/fragment/stars/price/`, {
    method: 'POST',
    body: { quantity: qty },
  });
  if (r.status === 200 && r.body) {
    const raw = r.body.ton ?? r.body.price;
    let ton = typeof raw === 'string' ? Number(raw) : raw;
    // اگر نانو بود (عدد بزرگ بدون اعشار) تبدیل شود
    if (ton && ton > 1e6) ton = ton / 1e9;
    if (ton && ton > 0) {
      const out: StarsPrice = { ton: Math.round(ton * 1e9) / 1e9, source: 'marketapp' };
      memSet(key, out);
      return out;
    }
  }
  if (r.status !== 0 && !isTokenInvalid(r.body) && r.status !== 402) {
    // خطای غیرمنتظرهٔ API — به قیمت ادمین برمی‌گردیم
  }

  // ۲/۳) قیمت ادمین یا پیش‌فرض — مدل خطی بر مبنای قیمت هر ۱۰۰ استارز
  const s = await getSettings();
  const per100 = s.price_stars_per100 > 0 ? s.price_stars_per100 : 1.132;
  const out: StarsPrice = { ton: Math.round(((qty / 100) * per100) * 1e9) / 1e9, source: 'admin' };
  memSet(key, out);
  return out;
}

export type PremiumPrice = { ton: number; source: 'marketapp' | 'admin' | 'default' };

/** قیمت پرمیوم به TON برای ۳/۶/۱۲ ماه */
export async function getPremiumPriceTon(months: number): Promise<PremiumPrice | null> {
  const m2 = [3, 6, 12].includes(months) ? months : 3;
  const key = `premprice:${m2}`;
  const m = memGet<PremiumPrice>(key, 90_000);
  if (m) return m;

  const r = await maFetch<{ ton?: number | string; price?: number | string }>(`/v1/fragment/premium/price/`, {
    method: 'POST',
    body: { duration: m2 },
  });
  if (r.status === 200 && r.body) {
    const raw = r.body.ton ?? r.body.price;
    let ton = typeof raw === 'string' ? Number(raw) : raw;
    if (ton && ton > 1e6) ton = ton / 1e9;
    if (ton && ton > 0) {
      const out: PremiumPrice = { ton: Math.round(ton * 1e9) / 1e9, source: 'marketapp' };
      memSet(key, out);
      return out;
    }
  }

  const s = await getSettings();
  const base = m2 === 3 ? s.price_premium_3m : m2 === 6 ? s.price_premium_6m : s.price_premium_12m;
  const fallback = m2 === 3 ? 9.05 : m2 === 6 ? 12.07 : 21.88;
  const out: PremiumPrice = { ton: base > 0 ? base : fallback, source: 'admin' };
  memSet(key, out);
  return out;
}
