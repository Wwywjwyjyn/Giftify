/** قالب‌بندی اعداد/قیمت/مدت */

export function fromNano(nano: string | number | null | undefined): number {
  try {
    const n = typeof nano === 'number' ? nano : Number(nano || 0);
    return n / 1e9;
  } catch {
    return 0;
  }
}

/** نمایش TON با حداکثر ۴ رقم اعشار بدون صفرهای اضافی */
export function fmtTon(ton: number, maxFrac = 4): string {
  if (!Number.isFinite(ton)) return '0';
  const s = ton.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
  return s;
}

export function fmtNanoTon(nano: string | number | null | undefined): string {
  return fmtTon(fromNano(nano));
}

/** مدت ثانیه → «۱ تا ۳۴ روز» */
export function fmtDurationRange(minSec: number, maxSec: number): string {
  const d = (s: number) => Math.max(1, Math.round(s / 86400));
  const a = d(minSec);
  const b = d(maxSec);
  if (a === b) return `${faNum(a)} روز`;
  return `${faNum(a)} تا ${faNum(b)} روز`;
}

export function fmtDaysLeft(endSec: number | null | undefined): string {
  if (!endSec) return '—';
  const diff = endSec - Date.now() / 1000;
  if (diff <= 0) return 'پایان یافته';
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${faNum(days)} روز و ${faNum(hours)} ساعت باقی‌مانده`;
  return `${faNum(hours)} ساعت باقی‌مانده`;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** اعداد فارسی برای متن‌ها؛ قیمت‌های رمزارز با ارقام لاتین می‌مانند (مثل فرگمنت) */
export function faNum(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function shortAddr(a?: string | null): string {
  if (!a) return '—';
  return a.slice(0, 6) + '…' + a.slice(-4);
}

export function attrOf(attrs: { trait_type: string; value: unknown }[], type: string): string {
  const a = attrs?.find((x) => x.trait_type === type);
  return a ? String(a.value) : '—';
}

export function giftNumOf(name: string): number | null {
  const m = name.match(/#(\d+)/);
  return m ? Number(m[1]) : null;
}
