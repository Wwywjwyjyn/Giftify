import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';

/** لیستینگ‌های محلیِ به نام کیف پول کاربر جاری (اجاره‌دهی‌های من) */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.wallet) return Response.json({ listings: [], detail: 'برای مشاهدهٔ لیستینگ‌های خود، کیف پول را وصل کنید' });
  try {
    const listings = await db.localListing.findMany({
      where: { ownerWallet: user.wallet, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, kind: true, name: true, priceTon: true, rentPerDayTon: true },
    });
    return Response.json({ listings });
  } catch {
    return Response.json({ listings: [] });
  }
}
