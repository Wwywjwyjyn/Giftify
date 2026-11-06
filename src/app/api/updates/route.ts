import { db } from '@/lib/db';
import { APP_VERSION } from '@/lib/version';

export const dynamic = 'force-dynamic';

/** نسخهٔ کد + تاریخچهٔ عمومی به‌روزرسانی‌ها (بدون جزئیات محرمانه) */
export async function GET() {
  try {
    const rows = await db.siteUpdate.findMany({ orderBy: [{ appliedAt: 'desc' }], take: 20 });
    return Response.json({
      code_version: APP_VERSION,
      updates: rows.map((u) => ({
        version: u.version,
        title: u.title,
        changes: JSON.parse(u.changes || '[]') as { type: string; text: string }[],
        appliedAt: u.appliedAt,
      })),
    });
  } catch {
    return Response.json({ code_version: APP_VERSION, updates: [] });
  }
}
