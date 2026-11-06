import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

/** تأیید ارسال تراکنش توسط کاربر (پس از امضای کیف پول) */
export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return Response.json({ ok: false, detail: 'orderId لازم است' }, { status: 400 });
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return Response.json({ ok: false, detail: 'سفارش یافت نشد' }, { status: 404 });

    await db.order.update({ where: { id: orderId }, data: { status: 'TX_SENT' } });

    const meta = (() => {
      try {
        return JSON.parse(order.meta || '{}') as { local?: boolean; listingId?: string };
      } catch {
        return {} as { local?: boolean; listingId?: string };
      }
    })();

    // لیستینگ محلی: بعد از فروش/اجاره از بازار برداشته شود + کارمزد همان تراکنش پرداخت شده است
    if (meta.local && meta.listingId) {
      await db.localListing.updateMany({ where: { id: meta.listingId, priceTon: { not: null } }, data: { status: 'INACTIVE' } }).catch(() => {});
      const fee = await db.feeRecord.findFirst({ where: { orderId } });
      if (fee) await db.feeRecord.update({ where: { id: fee.id }, data: { status: 'PAID' } });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, detail: (e as Error).message }, { status: 500 });
  }
}
