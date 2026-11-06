/**
 * موتور مرکز بروزرسانی — اعتبارسنجی و اعمال فایل به‌روزرسانی.
 *
 * فرمت فایل (JSON):
 * {
 *   "app": "giftify",
 *   "type": "update",
 *   "version": "3.1.0",
 *   "title": "عنوان نسخه",
 *   "date": "2026-11-06",
 *   "changes": [ {"type": "fix|feature|improvement|security", "text": "…"} ],
 *   "settings": { "fee_rent": 3, "price_stars_per100": 1.4, … },   // اختیاری — فوراً اعمال می‌شود
 *   "notice": "…",                                                  // اختیاری — اعلان صفحه اصلی
 *   "code_changes": true                                            // اگر true یعنی این نسخه با کد جدید همراه است (ZIP)
 * }
 */
import { db } from './db';
import { saveSettings, type SiteSettings } from './settings';
import { APP_VERSION, MIN_CODE_VERSION, isNewerVersion } from './version';

export type UpdateChange = { type: string; text: string };

export type UpdateFile = {
  app?: string;
  type?: string;
  version: string;
  title?: string;
  date?: string;
  changes?: UpdateChange[];
  settings?: Partial<SiteSettings>;
  notice?: string;
  code_changes?: boolean;
  min_code_version?: string;
};

export type ApplyResult =
  | { ok: true; version: string; title: string; appliedSettings: boolean; duplicate: false }
  | { ok: false; detail: string };

const CHANGE_TYPES = new Set(['fix', 'feature', 'improvement', 'security', 'other']);

/** اعتبارسنجی کامل فایل */
export function validateUpdateFile(raw: unknown): { ok: true; data: UpdateFile } | { ok: false; detail: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, detail: 'فایل به‌روزرسانی معتبر نیست (JSON شیء نیست)' };
  const d = raw as UpdateFile;
  if (d.app && d.app !== 'giftify') return { ok: false, detail: 'این فایل برای قالب دیگری است (app ≠ giftify)' };
  if (d.type && d.type !== 'update') return { ok: false, detail: 'نوع فایل معتبر نیست (type ≠ update)' };
  const v = String(d.version || '').trim();
  if (!/^\d+\.\d+(\.\d+)?$/.test(v)) return { ok: false, detail: 'شمارهٔ نسخه معتبر نیست — مثلاً 3.1.0' };
  const needed = d.min_code_version || MIN_CODE_VERSION;
  if (isNewerVersion(needed, APP_VERSION)) {
    return { ok: false, detail: `این به‌روزرسانی به کد نسخهٔ ${needed} نیاز دارد؛ کد فعلی ${APP_VERSION} است — ابتدا ZIP جدید را روی هاست جایگزین کنید` };
  }
  const changes = Array.isArray(d.changes) ? d.changes : [];
  for (const c of changes) {
    if (!c || typeof c.text !== 'string' || !c.text.trim()) return { ok: false, detail: 'یکی از ردیف‌های «changes» متن ندارد' };
  }
  return { ok: true, data: { ...d, version: v, title: (d.title || `بروزرسانی ${v}`).slice(0, 200), changes: changes.map((c) => ({ type: CHANGE_TYPES.has(c.type) ? c.type : 'other', text: c.text.slice(0, 500) })) } };
}

/** اعمال فایل: ثبت تاریخچه + اعمال تنظیمات (در صورت وجود) */
export async function applyUpdateFile(data: UpdateFile, fileName?: string): Promise<ApplyResult> {
  const existing = await db.siteUpdate.findUnique({ where: { version: data.version } });
  if (existing) {
    return { ok: false, detail: `نسخهٔ ${data.version} قبلاً در تاریخچه ثبت شده است — شمارهٔ نسخهٔ فایل را بالا ببرید` };
  }

  let appliedSettings = false;
  const patch = data.settings && typeof data.settings === 'object' ? data.settings : {};
  const hasSettings = Object.keys(patch).length > 0;
  const notice = typeof data.notice === 'string' ? data.notice : undefined;
  if (hasSettings || (notice !== undefined && notice.trim() !== '')) {
    await saveSettings({ ...patch, ...(notice !== undefined ? { notice } : {}) });
    appliedSettings = true;
  }

  await db.siteUpdate.create({
    data: {
      version: data.version,
      title: data.title || `بروزرسانی ${data.version}`,
      changes: JSON.stringify(data.changes || []),
      fileName: fileName || null,
      appliedSettings,
    },
  });

  return { ok: true, version: data.version, title: data.title || `بروزرسانی ${data.version}`, appliedSettings, duplicate: false };
}

/** آخرین نسخهٔ اعمال‌شده (برای نمایش در پنل و فوتر) */
export async function latestAppliedVersion(): Promise<{ version: string; title: string; appliedAt: Date } | null> {
  const rows = await db.siteUpdate.findMany({ orderBy: [{ appliedAt: 'desc' }], take: 1 });
  if (!rows.length) return null;
  return { version: rows[0].version, title: rows[0].title, appliedAt: rows[0].appliedAt };
}
