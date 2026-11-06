import { NextRequest } from 'next/server';
import { requireAdminJson } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSettings, saveSettings } from '@/lib/settings';
import { creditBalance } from '@/lib/wallet';
import { safeDetail } from '@/lib/errors';

/** مسیرهای مدیریت: settings | orders | fees | users | listings */
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { path } = await ctx.params;
  const op = path[0];
  const sp = req.nextUrl.searchParams;

  try {
    if (op === 'settings') return Response.json(await getSettings());

    if (op === 'orders') {
      const orders = await db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
      const fees = await db.feeRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
      return Response.json({ orders, fees });
    }

    if (op === 'users') {
      const users = await db.user.findMany({ orderBy: { id: 'asc' }, take: 500 });
      const accounts = await db.walletAccount.findMany();
      const balOf = new Map(accounts.map((a) => [a.userId, a.balanceTon]));
      return Response.json({ users: users.map((u) => ({ ...u, balanceTon: balOf.get(u.id) ?? 0 })) });
    }

    if (op === 'wallets') {
      const rows = await db.walletAccount.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 });
      const users = await db.user.findMany();
      const userOf = new Map(users.map((u) => [u.id, u]));
      return Response.json({
        accounts: rows.map((a) => ({
          id: a.id, userId: a.userId, memoCode: a.memoCode, balanceTon: a.balanceTon,
          wallet: userOf.get(a.userId)?.wallet || null, name: userOf.get(a.userId)?.name || null,
        })),
      });
    }

    if (op === 'listings') {
      const listings = await db.localListing.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
      return Response.json({ listings });
    }

    return Response.json({ detail: 'نامشخص' }, { status: 404 });
  } catch (e) {
    return Response.json({ detail: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { path } = await ctx.params;
  const op = path[0];
  const body = await req.json().catch(() => ({}));

  try {
    if (op === 'settings') {
      const s = await saveSettings(body);
      return Response.json(s);
    }
    if (op === 'fees') {
      const id = String(body.id || '');
      const status = body.status === 'PAID' ? 'PAID' : 'PENDING';
      const txHash = body.txHash ? String(body.txHash) : null;
      await db.feeRecord.update({ where: { id }, data: { status, txHash } });
      return Response.json({ ok: true });
    }
    if (op === 'users') {
      const id = Number(body.id || 0);
      const role = body.role === 'ADMIN' ? 'ADMIN' : 'USER';
      // جلوگیری از حذف آخرین مدیر
      if (role === 'USER') {
        const admins = await db.user.count({ where: { role: 'ADMIN' } });
        const target = await db.user.findUnique({ where: { id } });
        if (target?.role === 'ADMIN' && admins <= 1) {
          return Response.json({ detail: 'حداقل یک مدیر باید بماند' }, { status: 400 });
        }
      }
      await db.user.update({ where: { id }, data: { role } });
      return Response.json({ ok: true });
    }
    if (op === 'listings') {
      const created = await db.localListing.create({
        data: {
          ownerWallet: String(body.ownerWallet || '').trim() || 'unknown',
          kind: ['gift', 'username', 'number'].includes(body.kind) ? body.kind : 'gift',
          name: String(body.name || 'بدون نام').slice(0, 120),
          collectionSlug: body.collectionSlug ? String(body.collectionSlug).toLowerCase().replace(/[^a-z0-9]/g, '') : null,
          itemNum: body.itemNum ? Number(body.itemNum) : null,
          nftAddress: body.nftAddress ? String(body.nftAddress).trim() : null,
          priceTon: body.priceTon ? Number(body.priceTon) : null,
          rentPerDayTon: body.rentPerDayTon ? Number(body.rentPerDayTon) : null,
          rentMinDays: Number(body.rentMinDays) || 1,
          rentMaxDays: Number(body.rentMaxDays) || 30,
        },
      });
      return Response.json({ ok: true, listing: created });
    }

    // مدیریت سفارش‌ها: deliver (تحویل شد) | complete | refund (بازگشت مبلغ به خریدار) | fail
    if (op === 'orders') {
      const id = String(body.id || '');
      const act = String(body.action || '');
      const order = await db.order.findUnique({ where: { id } });
      if (!order) return Response.json({ detail: 'سفارش یافت نشد' }, { status: 404 });

      if (act === 'deliver' || act === 'complete') {
        await db.order.update({ where: { id }, data: { status: act === 'deliver' ? 'DELIVERED' : 'DONE' } });
        return Response.json({ ok: true });
      }
      if ((act === 'refund' || act === 'fail') && ['REFUNDED', 'FAILED', 'DONE'].includes(order.status)) {
        return Response.json({ detail: 'این سفارش قبلاً نهایی شده است' }, { status: 400 });
      }
      if (act === 'refund') {
        // بازگشت کامل مبلغ به کیف پول داخلی خریدار (سفارش‌های پرداخت‌شده)
        if (order.payMethod === 'wallet' && order.userId) {
          const bal = await creditBalance(order.userId, order.amountTon, 'REFUND', { orderId: order.id, note: `بازگشت مبلغ سفارش ${order.title}` });
          if (bal < 0) return Response.json({ detail: 'بازگشت مبلغ ممکن نشد' }, { status: 500 });
        }
        await db.order.update({ where: { id }, data: { status: 'REFUNDED' } });
        const fee = await db.feeRecord.findFirst({ where: { orderId: id } });
        if (fee) await db.feeRecord.update({ where: { id: fee.id }, data: { status: 'PENDING' } });
        return Response.json({ ok: true });
      }
      if (act === 'fail') {
        if (order.payMethod === 'wallet' && order.userId) {
          await creditBalance(order.userId, order.amountTon, 'REFUND', { orderId: order.id, note: `برگشت مبلغ سفارش ناموفق ${order.title}` });
        }
        await db.order.update({ where: { id }, data: { status: 'FAILED' } });
        return Response.json({ ok: true });
      }
      return Response.json({ detail: 'اکشن نامشخص' }, { status: 400 });
    }

    // شارژ دستی کیف پول کاربر (در صورت نیاز پشتیبانی)
    if (op === 'wallet-credit') {
      const userId = Number(body.userId || 0);
      const amount = Number(body.amountTon || 0);
      if (!userId || !(amount > 0)) return Response.json({ detail: 'پارامتر ناقص' }, { status: 400 });
      const bal = await creditBalance(userId, amount, 'DEPOSIT', { note: String(body.note || 'شارژ دستی توسط پشتیبانی') });
      return Response.json({ ok: bal >= 0, balanceTon: bal });
    }
    return Response.json({ detail: 'نامشخص' }, { status: 404 });
  } catch (e) {
    return Response.json({ detail: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const { path } = await ctx.params;
  const op = path[0];
  if (op === 'listings') {
    const id = req.nextUrl.searchParams.get('id') || '';
    await db.localListing.delete({ where: { id } }).catch(() => {});
    return Response.json({ ok: true });
  }
  return Response.json({ detail: 'نامشخص' }, { status: 404 });
}
