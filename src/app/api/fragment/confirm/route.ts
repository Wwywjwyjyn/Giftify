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

    // اگر کارمزد در تراکنش پرداخت شده (لیستینگ محلی)، ثبت پرداخت
    if (order.meta.includes('local')) {
      const fee = await db.feeRecord.findFirst({ where: { orderId } });
      if (fee) await db.feeRecord.update({ where: { id: fee.id }, data: { status: 'PAID' } });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, detail: (e as Error).message }, { status: 500 });
  }
}
