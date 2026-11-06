import { MARKETAPP_BASE } from './env';
import { env } from './env';

export type MAResponse<T = unknown> = { status: number; body: T | null };

/** آیا پاسخ یعنی «پلن پولی لازم است»؟ */
export function isPaidRequired(status: number, body: unknown): boolean {
  if (status === 402) return true;
  const detail = (body as { detail?: string } | null)?.detail || '';
  return typeof detail === 'string' && detail.toLowerCase().includes('paid api plan');
}

/** آیا توکن نامعتبر/منقضی است؟ (AUTH_09) */
export function isTokenInvalid(body: unknown): boolean {
  const b = body as { detail?: string; code?: string } | null;
  if (!b) return false;
  if (b.code === 'AUTH_09') return true;
  const detail = b.detail || '';
  return typeof detail === 'string' && /invalid or expired token/i.test(detail);
}

export const TOKEN_INVALID_FA =
  'بخش اجارهٔ مارکت جهانی موقتاً در دسترس نیست — لیستینگ‌های همین سایت کاملاً فعال‌اند و می‌توانید همین حالا بخرید و اجاره کنید.';

export async function maFetch<T>(
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string | number | undefined | null> } = {},
  timeoutMs = 20000,
): Promise<MAResponse<T>> {
  const token = env.marketappToken;
  if (!token) return { status: 500, body: { detail: 'MARKETAPP_API_TOKEN تنظیم نشده است' } as T };

  let url = MARKETAPP_BASE + path;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += '?' + s;
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: {
        Authorization: token, // نکته مهم: توکن خام، بدون پیشوند Bearer
        'Content-Type': 'application/json',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctl.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body: body as T };
  } catch (e) {
    return { status: 0, body: { detail: `خطای اتصال به Marketapp: ${(e as Error).message}` } as T };
  } finally {
    clearTimeout(timer);
  }
}
