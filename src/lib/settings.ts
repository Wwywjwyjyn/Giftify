import { db } from './db';

/** کارمزد هر بخش (درصد) + کیف پول کارمزد ادمین + کیف واریز + قیمت‌ها */
export type SiteSettings = {
  site_name: string;
  fee_wallet: string; // آدرس TON ادمین برای دریافت کارمزد
  deposit_wallet: string; // کیف واریز گرام کاربران — جدا از کیف کارمزد و کیف خود کاربر
  fee_usernames: number;
  fee_numbers: number;
  fee_gifts: number;
  fee_rent: number;
  fee_stars: number;
  fee_premium: number;
  fee_giveaway: number;
  fee_ads: number;
  price_stars_per100: number; // قیمت هر ۱۰۰ استارز به TON (قابل ویرایش در پنل)
  price_premium_3m: number; // قیمت پرمیوم ۳ ماه به TON
  price_premium_6m: number;
  price_premium_12m: number;
  notice: string; // اعلان دلخواه در صفحه اصلی (اختیاری)
};

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: process.env.NEXT_PUBLIC_SITE_NAME || 'Giftify',
  fee_wallet: '',
  deposit_wallet: '',
  fee_usernames: 2,
  fee_numbers: 2,
  fee_gifts: 2,
  fee_rent: 3,
  fee_stars: 1,
  fee_premium: 1,
  fee_giveaway: 1,
  fee_ads: 0,
  // آخرین قیمت‌های واقعی ثبت‌شده از API فرگمنت — ادمین می‌تواند همیشه به‌روز کند
  price_stars_per100: 1.132,
  price_premium_3m: 9.05,
  price_premium_6m: 12.07,
  price_premium_12m: 21.88,
  notice: '',
};

const SETTINGS_KEY = 'site_settings';

export async function getSettings(): Promise<SiteSettings> {
  try {
    const row = await db.setting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(row.value) as Partial<SiteSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const cur = await getSettings();
  const next: SiteSettings = { ...cur };
  const numKeys: (keyof SiteSettings)[] = [
    'fee_usernames', 'fee_numbers', 'fee_gifts', 'fee_rent', 'fee_stars', 'fee_premium', 'fee_giveaway', 'fee_ads',
    'price_stars_per100', 'price_premium_3m', 'price_premium_6m', 'price_premium_12m',
  ];
  for (const k of Object.keys(patch) as (keyof SiteSettings)[]) {
    const v = patch[k];
    if (numKeys.includes(k)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 100000) (next[k] as number) = n;
    } else if (typeof v === 'string') {
      (next[k] as string) = String(v).slice(0, 300);
    }
  }
  await db.setting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(next) },
  });
  return next;
}

/** کارمزد یک بخش بر حسب درصد */
export function feePercentOf(s: SiteSettings, section: string): number {
  switch (section) {
    case 'usernames': return s.fee_usernames;
    case 'numbers': return s.fee_numbers;
    case 'gifts': return s.fee_gifts;
    case 'rent': return s.fee_rent;
    case 'stars': return s.fee_stars;
    case 'premium': return s.fee_premium;
    case 'giveaway': return s.fee_giveaway;
    case 'ads': return s.fee_ads;
    default: return 0;
  }
}
