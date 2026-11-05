/** تنظیمات محیطی — توکن Marketapp فقط سمت سرور */
export const env = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Giftify',
  jwtSecret: process.env.JWT_SECRET || '',
  marketappToken: process.env.MARKETAPP_API_TOKEN || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramBotUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || '',
};

export const MARKETAPP_BASE = 'https://api.marketapp.org';
export const TONAPI_BASE = 'https://tonapi.io';
