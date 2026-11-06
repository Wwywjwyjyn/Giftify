/** نسخهٔ فعلی کد Giftify — با هر انتشار کد به‌روز می‌شود */
export const APP_VERSION = '3.1.0';

/** قدیمی‌ترین نسخهٔ کدی که فایل‌های به‌روزرسانی جدید به آن نیاز دارند */
export const MIN_CODE_VERSION = '3.0.0';

/** مقایسهٔ semver ساده: a جدیدتر از b؟ */
export function isNewerVersion(a: string, b: string): boolean {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}
