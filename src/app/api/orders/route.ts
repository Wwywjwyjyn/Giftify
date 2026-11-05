import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';

/** سفارش‌های کاربر جاری */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ orders: [] });
  try {
    const orders = await db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return Response.json({ orders });
  } catch {
    return Response.json({ orders: [] });
  }
}
