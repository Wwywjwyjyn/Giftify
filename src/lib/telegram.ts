/** تأیید Telegram WebApp initData (طبق مستند رسمی تلگرام) */
import crypto from 'crypto';
import { env } from './env';

export type TgUser = { id: number; first_name?: string; username?: string; photo_url?: string };

export function verifyInitData(initData: string): { ok: boolean; user?: TgUser; reason?: string } {
  try {
    if (!initData) return { ok: false, reason: 'initData خالی است' };
    const token = env.telegramBotToken;
    if (!token) return { ok: false, reason: 'TELEGRAM_BOT_TOKEN تنظیم نشده' };

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    params.delete('signature');

    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');

    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if (hmac !== hash) return { ok: false, reason: 'امضای initData معتبر نیست' };

    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate || Date.now() / 1000 - authDate > 86400) return { ok: false, reason: 'initData منقضی شده' };

    const rawUser = params.get('user');
    if (!rawUser) return { ok: false, reason: 'کاربر در initData نیست' };
    const user = JSON.parse(rawUser) as TgUser;
    if (!user?.id) return { ok: false, reason: 'شناسه کاربر نامعتبر' };
    return { ok: true, user };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
