/**
 * پیام‌های خطای کاربرپسند — کاربر عادی نباید متن فنی/باگ ببیند.
 * همهٔ خطاهای API از اینجا فارسیِ ساده برمی‌گردانند.
 */

const MAP: [RegExp, string][] = [
  [/invalid or expired token|AUTH_09/i, 'سرویس بازار موقتاً در دسترس نیست. به‌زودی برمی‌گردد — برای خرید از لیستینگ‌های سایت استفاده کنید.'],
  [/paid api plan|402/i, 'این بخش از سرویس بازار موقتاً محدود است. لیستینگ‌های سایت کاملاً فعال‌اند.'],
  [/timeout|abort/i, 'پاسخی دریافت نشد — دوباره تلاش کنید.'],
  [/network|fetch failed|ENOTFOUND|ECONNREFUSED/i, 'اتصال برقرار نشد — اینترنت خود را بررسی کنید و دوباره تلاش کنید.'],
  [/insufficient|not enough|موجودی/i, 'موجودی کیف پول کافی نیست. اول از صفحهٔ کیف پول شارژ کنید.'],
  [/Transaction was not sent|User declined|canceled|cancelled/i, 'پرداخت لغو شد — مبلغی از شما کسر نشده است.'],
  [/rate limit|429/i, 'سرور شلوغ است — چند لحظه بعد دوباره تلاش کنید.'],
];

export function friendlyError(e: unknown, fallback = 'خطای غیرمنتظره — دوباره تلاش کنید'): string {
  const msg = e instanceof Error ? e.message : String(e || '');
  for (const [re, fa] of MAP) if (re.test(msg)) return fa;
  return fallback;
}

/** پیام امن برای کاربر عادی؛ جزئیات فنی فقط در لاگ سرور می‌ماند */
export function safeDetail(detail: string | undefined | null, fallback = 'خطای غیرمنتظره — دوباره تلاش کنید'): string {
  if (!detail) return fallback;
  for (const [re, fa] of MAP) if (re.test(detail)) return fa;
  return detail;
}
