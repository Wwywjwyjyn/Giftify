import { NextRequest } from 'next/server';
import { maFetch } from '@/lib/marketapp';
import { fromNano } from '@/lib/format';
import { db } from '@/lib/db';
import { getSessionUser, requireAdminJson } from '@/lib/auth';
import { getSettings, feePercentOf } from '@/lib/settings';
import type { SendTx } from '@/lib/types';

/**
 * اکشن‌های اجاره: pay | extend | cancel | my | history | rent-out | update-settings
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const op = action[0];
  const body = await req.json().catch(() => ({}));
  const settings = await getSettings();

  // عملیات روی حساب صاحب توکن API فقط برای مدیر
  if (['cancel', 'rent-out', 'update-settings'].includes(op)) {
    const denied = await requireAdminJson();
    if (denied) return denied;
  }

  try {
    // پرداخت اجاره
    if (op === 'pay') {
      const nft = String(body.nft_address || '');
      const duration = Number(body.duration || 0);
      const pricePerDay = String(body.price_per_day || '');
      if (!nft || !duration || !pricePerDay) return Response.json({ ok: false, detail: 'پارامترهای اجاره ناقص است' }, { status: 400 });

      // اجارهٔ لیستینگ محلی سایت — ثبت سفارش برای تأیید مالک (بدون endpoint پولی مارکت‌اپ)
      if (nft.startsWith('local:')) {
        const listing = await db.localListing.findUnique({ where: { id: nft.replace('local:', '') } });
        if (!listing || !listing.rentPerDayTon) return Response.json({ ok: false, detail: 'لیستینگ اجاره یافت نشد' }, { status: 404 });
        const user = await getSessionUser();
        const total = listing.rentPerDayTon * (duration / 86400);
        const feeTon = Math.round(total * feePercentOf(settings, 'rent')) / 100;
        const order = await db.order.create({
          data: {
            userId: user?.id ?? null, kind: 'rent',
            title: `اجارهٔ ${Math.round(duration / 86400)} روزهٔ ${listing.name} (لیستینگ سایت)`,
            amountTon: total, feeTon, currency: 'TON', status: 'PENDING_TX',
            meta: JSON.stringify({ local: true, listingId: listing.id, duration }),
          },
        });
        if (feeTon > 0 && settings.fee_wallet) {
          await db.feeRecord.create({ data: { orderId: order.id, section: 'rent', amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' } });
        }
        return Response.json({
          ok: true, orderId: order.id, local_rent: true,
          tx: {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [{ address: listing.ownerWallet, amount: String(Math.round(total * 1e9)) }],
          },
        });
      }

      const r = await maFetch<SendTx>(`/v1/rent/${nft}/pay/`, {
        method: 'POST',
        body: { duration, price_per_day: pricePerDay, sale_during_rent: false },
      });
      if (r.status !== 200 || !r.body?.messages) {
        const b = r.body as { detail?: string } | null;
        return Response.json({ ok: false, detail: b?.detail || 'اجاره در دسترس نیست' }, { status: r.status === 0 ? 502 : r.status });
      }
      const user = await getSessionUser();
      const amountTon = fromNano(r.body.messages[0]?.amount || 0);
      const feeTon = Math.round(amountTon * feePercentOf(settings, 'rent')) / 100;
      const order = await db.order.create({
        data: {
          userId: user?.id ?? null, kind: 'rent', title: `اجاره ${Math.round(duration / 86400)} روزه`,
          amountTon, feeTon, currency: 'TON', status: 'PENDING_TX', meta: JSON.stringify({ nft, duration }),
        },
      });
      if (feeTon > 0 && settings.fee_wallet) {
        await db.feeRecord.create({ data: { orderId: order.id, section: 'rent', amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' } });
      }
      return Response.json({ ok: true, tx: r.body, orderId: order.id });
    }

    // تمدید اجاره
    if (op === 'extend') {
      const nft = String(body.nft_address || '');
      const r = await maFetch<SendTx>(`/v1/rent/${nft}/extend/`, {
        method: 'POST',
        body: { duration: Number(body.duration || 0), price_per_day: String(body.price_per_day || '') },
      });
      if (r.status !== 200 || !r.body?.messages) {
        const b = r.body as { detail?: string } | null;
        return Response.json({ ok: false, detail: b?.detail || 'تمدید در دسترس نیست' }, { status: r.status === 0 ? 502 : r.status });
      }
      return Response.json({ ok: true, tx: r.body });
    }

    // لغو اجاره (اجاره‌دهنده)
    if (op === 'cancel') {
      const r = await maFetch<SendTx>('/v1/rent/cancel/', { method: 'POST', body: { nft_addresses: body.nft_addresses || [body.nft_address] } });
      if (r.status !== 200 || !r.body?.messages) {
        const b = r.body as { detail?: string } | null;
        return Response.json({ ok: false, detail: b?.detail || 'لغو ممکن نشد' }, { status: r.status === 0 ? 502 : r.status });
      }
      return Response.json({ ok: true, tx: r.body });
    }

    // اجاره دادن (فقط آیتم‌های کیف پول توکن API)
    if (op === 'rent-out' || op === 'update-settings') {
      const category = ['gifts', 'usernames', 'numbers'].includes(body.category) ? body.category : 'gifts';
      const endpoint = op === 'rent-out' ? `/v1/rent/${category}/rent-out/` : `/v1/rent/${category}/update-settings/`;
      const items = (body.items || []).map((it: Record<string, unknown>) => ({
        nft_address: String(it.nft_address || ''),
        ...(category !== 'numbers'
          ? { is_auto_relist: !!it.is_auto_relist, discount_pd: Number(it.discount_pd || 0), sale_price: Number(it.sale_price || 0), sale_during_rent: !!it.sale_during_rent }
          : {}),
        min_duration: Number(it.min_duration || 86400),
        max_duration: Number(it.max_duration || 86400 * 30),
        price_per_day: Number(it.price_per_day || 0),
      }));
      const r = await maFetch<SendTx>(endpoint, { method: 'POST', body: { items } });
      if (r.status !== 200 || !r.body?.messages) {
        const b = r.body as { detail?: string } | null;
        return Response.json({ ok: false, detail: b?.detail || 'اجاره‌دادن در دسترس نیست (آیتم باید متعلق به کیف پول توکن API باشد)' }, { status: r.status === 0 ? 502 : r.status });
      }
      return Response.json({ ok: true, tx: r.body });
    }

    return Response.json({ ok: false, detail: 'اکشن نامشخص' }, { status: 404 });
  } catch (e) {
    return Response.json({ ok: false, detail: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const op = action[0];
  const sp = req.nextUrl.searchParams;

  try {
    if (op === 'my') {
      // اجاره‌های حساب صاحب توکن API → فقط مدیر
      const denied = await requireAdminJson();
      if (denied) return denied;
      const r = await maFetch<{ items?: unknown[] }>('/v1/rent/my-rented/', { query: { limit: 50 } });
      return Response.json({ items: r.body?.items || [] });
    }
    if (op === 'history') {
      const category = ['gifts', 'usernames', 'numbers'].includes(sp.get('category') || '') ? sp.get('category') : 'gifts';
      const r = await maFetch<{ items?: unknown[] }>(`/v1/rent/${category}/history/`, { query: { limit: 20 } });
      return Response.json({ items: r.body?.items || [] });
    }
    return Response.json({ ok: false, detail: 'اکشن نامشخص' }, { status: 404 });
  } catch (e) {
    return Response.json({ ok: false, detail: (e as Error).message }, { status: 500 });
  }
}
