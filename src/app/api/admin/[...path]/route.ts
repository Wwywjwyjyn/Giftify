import { NextRequest } from 'next/server';
import { requireAdminJson } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSettings, saveSettings } from '@/lib/settings';

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
      return Response.json({ users });
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
      const settings = await getSettings();
      const created = await db.localListing.create({
        data: {
          ownerWallet: String(body.ownerWallet || settings.fee_wallet || 'unknown'),
          kind: ['gift', 'username', 'number'].includes(body.kind) ? body.kind : 'gift',
          name: String(body.name || 'بدون نام').slice(0, 120),
          collectionSlug: body.collectionSlug ? String(body.collectionSlug).toLowerCase().replace(/[^a-z0-9]/g, '') : null,
          itemNum: body.itemNum ? Number(body.itemNum) : null,
          priceTon: body.priceTon ? Number(body.priceTon) : null,
          rentPerDayTon: body.rentPerDayTon ? Number(body.rentPerDayTon) : null,
          rentMinDays: Number(body.rentMinDays) || 1,
          rentMaxDays: Number(body.rentMaxDays) || 30,
        },
      });
      return Response.json({ ok: true, listing: created });
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
