/**
 * resolve گیرندهٔ استارز/پرمیوم — دو منبع واقعی:
 *  ۱) API مارکت‌اپ (recipient) — منبع رسمی همان خریدی که انجام می‌شود؛
 *     نام و عکس واقعی می‌دهد و اگر یوزرنیم اکانت شخصی نباشد صریح می‌گوید
 *  ۲) صفحهٔ t.me — فال‌بک (برخی یوزرنیم‌های معتبر مثل durov را API رد می‌کند ولی t.me موجود است)
 *
 * فیلد photo در پاسخ API یک تگ HTML است:  <img src="…" />  — src استخراج می‌شود.
 */
import { maFetch } from './marketapp';
import { fetchTelegramPage } from './tgpage';

export type RecipientInfo = {
  ok: boolean;
  /** یوزرنیم پاک‌شده بدون @ */
  username: string;
  name?: string;
  photo?: string;
  members?: string;
  /** تأیید رسمی از API مارکت‌اپ (همان منبع خرید) */
  verified: boolean;
  /** هشدار: API این یوزرنیم را اکانت شخصی نشناخت — خرید فقط در صورت اکانت شخصی ممکن است */
  warning?: string;
  /** یادداشت نمایشی (مثلاً یوزرنیم فقط از t.me پیدا شد) */
  note?: string;
  detail?: string;
};

/** photo پاسخ API تگ HTML است — src واقعی استخراج می‌شود */
function extractImgSrc(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('<img')) {
    const m = raw.match(/src="([^"]+)"/);
    if (m) return decodeURIComponent(m[1]);
  }
  return raw;
}

export async function resolveRecipient(rawUsername: string, kind: 'stars' | 'premium' = 'premium'): Promise<RecipientInfo> {
  const username = rawUsername
    .replace(/^https?:\/\/(www\.)?t\.me\//i, '')
    .replace(/^@/, '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '');
  if (username.length < 3) return { ok: false, username, verified: false, detail: 'یوزرنیم حداقل ۳ حرف است' };

  // ۱) منبع رسمی خرید — API مارکت‌اپ
  const r = await maFetch<{ name?: string; photo?: string }>(`/v1/fragment/${kind}/recipient/`, {
    method: 'POST',
    body: { username },
  }, 15000);
  if (r.status === 200 && r.body) {
    const name = (r.body.name || '').trim();
    const photo = extractImgSrc(r.body.photo);
    if (name || photo) {
      return { ok: true, username, name: name || username, photo, verified: true };
    }
  }

  const d = (r.body as { detail?: string } | null)?.detail || '';
  const apiRejectedAsChannel = r.status !== 0 && /assigned to a user/i.test(d);
  const apiSaysMissing = r.status !== 0 && /user not found|invalid username/i.test(d);

  // ۲) فال‌بک: t.me — یوزرنیم موجود است ولی تأیید نهایی خرید با فرگمنت انجام می‌شود
  const info = await fetchTelegramPage(username);
  if (info.exists) {
    if (apiRejectedAsChannel) {
      return {
        ok: true,
        username,
        name: info.title,
        photo: info.image || extractImgSrc(undefined),
        members: info.members,
        verified: false,
        warning: 'این یوزرنیم در سیستم خرید به‌عنوان اکانت شخصی شناسایی نشد — اگر کانال یا ربات باشد، خرید استارز/پرمیوم برای آن ممکن نیست (تلگرام فقط به اکانت شخصی اجازه می‌دهد). تأیید نهایی هنگام پرداخت انجام می‌شود.',
      };
    }
    return {
      ok: true,
      username,
      name: info.title,
      photo: info.image,
      members: info.members,
      verified: false,
      note: apiSaysMissing ? 'یوزرنیم پیدا شد؛ تأیید نهایی هنگام پرداخت انجام می‌شود' : undefined,
    };
  }

  if (apiRejectedAsChannel) {
    return { ok: false, username, verified: false, detail: 'این یوزرنیم اکانت شخصی تلگرام نیست (کانال/ربات است) و خرید استارز/پرمیوم فقط برای اکانت شخصی ممکن است' };
  }
  return { ok: false, username, verified: false, detail: 'چنین یوزرنیمی در تلگرام وجود ندارد — دوباره بررسی کنید' };
}
