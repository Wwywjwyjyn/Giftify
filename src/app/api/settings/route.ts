import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';

/** تنظیمات عمومی — کارمزدها، کیف‌ها و قیمت‌ها برای شفافیت کامل */
export async function GET() {
  const s = await getSettings();
  return Response.json({
    site_name: s.site_name,
    notice: s.notice,
    fee_wallet: s.fee_wallet,
    deposit_wallet_set: !!s.deposit_wallet,
    fee_usernames: s.fee_usernames,
    fee_numbers: s.fee_numbers,
    fee_gifts: s.fee_gifts,
    fee_rent: s.fee_rent,
    fee_stars: s.fee_stars,
    fee_premium: s.fee_premium,
    fee_giveaway: s.fee_giveaway,
    fee_ads: s.fee_ads,
    price_stars_per100: s.price_stars_per100,
    price_premium_3m: s.price_premium_3m,
    price_premium_6m: s.price_premium_6m,
    price_premium_12m: s.price_premium_12m,
    telegram_bot_username: env.telegramBotUsername,
  });
}
