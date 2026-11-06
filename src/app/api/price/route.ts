import { NextRequest } from 'next/server';
import { getStarsPriceTon, getPremiumPriceTon } from '@/lib/pricing';

/**
 * قیمت استارز/پرمیوم — GET /api/price?kind=stars&qty=100  یا  ?kind=premium&months=3
 * منبع واقعی: مارکت‌اپ (وقتی توکن معتبر است) وگرنه قیمت تنظیمی ادمین.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get('kind') || 'stars';
  try {
    if (kind === 'stars') {
      const qty = Number(sp.get('qty') || 0);
      const p = await getStarsPriceTon(qty);
      if (!p) return Response.json({ ok: false, detail: 'مقدار استارز نامعتبر است' }, { status: 400 });
      return Response.json({ ok: true, kind, qty, ton: p.ton, source: p.source });
    }
    const months = Number(sp.get('months') || 3);
    const p = await getPremiumPriceTon(months);
    if (!p) return Response.json({ ok: false, detail: 'مدت پرمیوم نامعتبر است' }, { status: 400 });
    return Response.json({ ok: true, kind: 'premium', months, ton: p.ton, source: p.source });
  } catch {
    return Response.json({ ok: false, detail: 'دریافت قیمت ممکن نشد — دوباره تلاش کنید' }, { status: 500 });
  }
}
