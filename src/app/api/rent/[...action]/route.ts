import { NextRequest } from 'next/server';
import { maFetch } from '@/lib/marketapp';
import { fromNano } from '@/lib/format';
import { db } from '@/lib/db';
import { getSessionUser, requireAdminJson } from '@/lib/auth';
import { getSettings, feePercentOf } from '@/lib/settings';
import { spendBalance, creditBalance, calcFee } from '@/lib/wallet';
import { buildNftTransferTx, toRawAddress } from '@/lib/nfttx';
import { getNft } from '@/lib/tonapi';
import type { SendTx } from '@/lib/types';
import { safeDetail } from '@/lib/errors';

/**
 * اکشن‌های اجاره — همه واقعی و کارآمد:
 *   pay      → اجارهٔ لیستینگ سایت (کیف پول داخلی = امانی / TON Connect = مستقیم) یا مارکت‌اپ (توکن معتبر)
 *   deliver  → مالک: تراکنش واقعی انتقال NFT به اجاره‌گیرنده (TEP-62)
 *   return   → اجاره‌گیرنده: تراکنش بازگرداندن NFT به مالک
 *   verify   → بررسی مالکیت روی زنجیره و تسویهٔ امانی
 *   extend | cancel | rent-out | update-settings | my | history (مارکت‌اپ)
 */

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const op = action[0];
  const body = await req.json().catch(() => ({}));
  const settings = await getSettings();
  const user = await getSessionUser();

  // عملیات روی حساب صاحب توکن API فقط برای مدیر
  if (['cancel', 'rent-out', 'update-settings'].includes(op)) {
    const denied = await requireAdminJson();
    if (denied) return denied;
  }

  try {
    // ---------------- پرداخت اجاره ----------------
    if (op === 'pay') {
      const nft = String(body.nft_address || '');
      const duration = Number(body.duration || 0);
      const pricePerDay = String(body.price_per_day || '');
      if (!nft || !duration || !pricePerDay) return Response.json({ ok: false, detail: 'پارامترهای اجاره ناقص است' }, { status: 400 });
      const days = Math.max(1, Math.round(duration / 86400));
      const payWith: 'wallet' | 'ton' = body.pay_with === 'wallet' ? 'wallet' : 'ton';

      // اجارهٔ لیستینگ محلی سایت
      if (nft.startsWith('local:')) {
        const listing = await db.localListing.findUnique({ where: { id: nft.replace('local:', '') } });
        if (!listing || !listing.rentPerDayTon) return Response.json({ ok: false, detail: 'لیستینگ اجاره یافت نشد' }, { status: 404 });
        if (!user) return Response.json({ ok: false, detail: 'برای اجاره اول وارد شوید' }, { status: 401 });
        if (user.wallet && toRawAddress(user.wallet) === toRawAddress(listing.ownerWallet)) {
          return Response.json({ ok: false, detail: 'این آیتم از آنِ خود شماست' }, { status: 400 });
        }

        const total = Math.round(listing.rentPerDayTon * days * 1e9) / 1e9;
        const feeTon = calcFee(total, feePercentOf(settings, 'rent'));
        const endAt = new Date(Date.now() + days * 86400 * 1000);

        if (payWith === 'wallet') {
          // امانی: مبلغ از اجاره‌گیرنده کسر و تا تحویل NFT نزد سایت می‌ماند
          const bal = await spendBalance(user.id, total, `اجارهٔ ${days} روزهٔ ${listing.name}`);
          if (bal === null) return Response.json({ ok: false, detail: 'موجودی کیف پول کافی نیست — از صفحهٔ کیف پول شارژ کنید' }, { status: 400 });
          const order = await db.order.create({
            data: {
              userId: user.id,
              kind: 'local_rent',
              title: `اجارهٔ ${days} روزهٔ ${listing.name}`,
              amountTon: total,
              feeTon,
              currency: 'TON',
              status: 'RENT_ACTIVE',
              payMethod: 'wallet',
              nftAddress: listing.nftAddress || null,
              sellerWallet: listing.ownerWallet,
              endAt,
              meta: JSON.stringify({ local: true, listingId: listing.id, duration }),
            },
          });
          if (feeTon > 0) {
            await db.feeRecord.create({ data: { orderId: order.id, section: 'rent', amountTon: feeTon, wallet: settings.fee_wallet || '(کیف پول داخلی)', status: 'PENDING' } });
          }
          return Response.json({
            ok: true,
            wallet_paid: true,
            orderId: order.id,
            balanceTon: bal,
            detail: 'پرداخت انجام شد و نزد سایت امانی است — مالک آیتم را تحویل می‌دهد',
          });
        }

        // TON Connect: پرداخت مستقیم به مالک + پیام کارمزد
        const messages: SendTx['messages'] = [{ address: listing.ownerWallet, amount: String(Math.round(total * 1e9)) }];
        const feeNano = String(Math.round(feeTon * 1e9));
        if (feeNano !== '0' && settings.fee_wallet) messages.push({ address: settings.fee_wallet, amount: feeNano });
        const order = await db.order.create({
          data: {
            userId: user.id,
            kind: 'local_rent',
            title: `اجارهٔ ${days} روزهٔ ${listing.name}`,
            amountTon: total,
            feeTon,
            currency: 'TON',
            status: 'PENDING_TX',
            payMethod: 'ton',
            nftAddress: listing.nftAddress || null,
            sellerWallet: listing.ownerWallet,
            endAt,
            meta: JSON.stringify({ local: true, listingId: listing.id, duration }),
          },
        });
        if (feeTon > 0 && settings.fee_wallet) {
          await db.feeRecord.create({ data: { orderId: order.id, section: 'rent', amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' } });
        }
        return Response.json({ ok: true, orderId: order.id, tx: { validUntil: Math.floor(Date.now() / 1000) + 600, messages } });
      }

      // اجارهٔ مارکت‌اپ (توکن معتبر) — تراکنش واقعی
      const r = await maFetch<SendTx>(`/v1/rent/${nft}/pay/`, {
        method: 'POST',
        body: { duration, price_per_day: pricePerDay, sale_during_rent: false },
      });
      if (r.status !== 200 || !r.body?.messages) {
        const b = r.body as { detail?: string } | null;
        return Response.json({ ok: false, detail: safeDetail(b?.detail || 'اجاره در دسترس نیست') }, { status: r.status === 0 ? 502 : r.status });
      }
      const amountTon = fromNano(r.body.messages[0]?.amount || 0);
      const feeTon = calcFee(amountTon, feePercentOf(settings, 'rent'));
      const order = await db.order.create({
        data: {
          userId: user?.id ?? null,
          kind: 'rent',
          title: `اجاره ${days} روزه`,
          amountTon,
          feeTon,
          currency: 'TON',
          status: 'PENDING_TX',
          payMethod: 'ton',
          nftAddress: nft,
          meta: JSON.stringify({ nft, duration }),
        },
      });
      if (feeTon > 0 && settings.fee_wallet) {
        await db.feeRecord.create({ data: { orderId: order.id, section: 'rent', amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' } });
      }
      return Response.json({ ok: true, tx: r.body, orderId: order.id });
    }

    // ---------------- تحویل NFT به اجاره‌گیرنده (مالک) ----------------
    if (op === 'deliver') {
      if (!user?.wallet) return Response.json({ ok: false, detail: 'اول کیف پول خود را وصل کنید' }, { status: 401 });
      const order = await db.order.findUnique({ where: { id: String(body.orderId || '') } });
      if (!order || order.kind !== 'local_rent') return Response.json({ ok: false, detail: 'سفارش اجاره یافت نشد' }, { status: 404 });
      if (toRawAddress(order.sellerWallet) !== toRawAddress(user.wallet)) {
        return Response.json({ ok: false, detail: 'این سفارش مربوط به کیف پول شما نیست' }, { status: 403 });
      }
      if (!order.nftAddress) return Response.json({ ok: false, detail: 'این لیستینگ آدرس NFT ندارد — تحویل با پشتیبانی انجام می‌شود' }, { status: 400 });
      const renter = await db.user.findUnique({ where: { id: order.userId || 0 } });
      if (!renter?.wallet) return Response.json({ ok: false, detail: 'کیف پول اجاره‌گیرنده ثبت نشده است' }, { status: 400 });
      const tx = buildNftTransferTx({
        nftAddress: order.nftAddress,
        fromAddress: user.wallet,
        toAddress: renter.wallet,
        comment: 'Giftify rent delivery',
      });
      return Response.json({ ok: true, tx, next: 'DELIVER_TX' });
    }

    // ---------------- بازگرداندن NFT به مالک (اجاره‌گیرنده) ----------------
    if (op === 'return') {
      if (!user?.wallet) return Response.json({ ok: false, detail: 'اول کیف پول خود را وصل کنید' }, { status: 401 });
      const order = await db.order.findUnique({ where: { id: String(body.orderId || '') } });
      if (!order || order.userId !== user.id) return Response.json({ ok: false, detail: 'سفارش یافت نشد' }, { status: 404 });
      if (!order.nftAddress) return Response.json({ ok: false, detail: 'این آیتم آدرس NFT ندارد' }, { status: 400 });
      if (!order.sellerWallet) return Response.json({ ok: false, detail: 'کیف پول مالک ثبت نشده است' }, { status: 400 });
      const tx = buildNftTransferTx({
        nftAddress: order.nftAddress,
        fromAddress: user.wallet,
        toAddress: order.sellerWallet,
        comment: 'Giftify rent return',
      });
      return Response.json({ ok: true, tx, next: 'RETURN_TX' });
    }

    // ---------------- بررسی مالکیت روی زنجیره + تسویه ----------------
    if (op === 'verify') {
      if (!user) return Response.json({ ok: false, detail: 'اول وارد شوید' }, { status: 401 });
      const order = await db.order.findUnique({ where: { id: String(body.orderId || '') } });
      if (!order) return Response.json({ ok: false, detail: 'سفارش یافت نشد' }, { status: 404 });
      // فقط مالک، اجاره‌گیرنده یا مدیر
      const isRenter = order.userId === user.id;
      const isOwner = !!user.wallet && !!order.sellerWallet && toRawAddress(user.wallet) === toRawAddress(order.sellerWallet);
      if (!isRenter && !isOwner && user.role !== 'ADMIN') return Response.json({ ok: false, detail: 'دسترسی ندارید' }, { status: 403 });
      if (!order.nftAddress) return Response.json({ ok: true, status: order.status, verified: false });

      const item = await getNft(order.nftAddress);
      const ownerOnChain = toRawAddress(item?.owner?.address || '');
      const ownerWallet = toRawAddress(order.sellerWallet);
      const renter = await db.user.findUnique({ where: { id: order.userId || 0 } });
      const renterWallet = toRawAddress(renter?.wallet || '');
      const expired = order.endAt ? order.endAt.getTime() < Date.now() : false;

      // تحویل شد؟ (NFT نزد اجاره‌گیرنده است)
      if (renterWallet && ownerOnChain === renterWallet && order.status === 'RENT_ACTIVE') {
        await db.order.updateMany({ where: { id: order.id, status: 'RENT_ACTIVE' }, data: { status: 'DELIVERED' } });
        return Response.json({ ok: true, status: 'DELIVERED', verified: true });
      }
      // برگشت و تسویه؟ فقط بعد از تحویل واقعی (DELIVERED/OVERDUE)؛ RENT_ACTIVE یعنی هنوز تحویل نشده
      if (ownerWallet && ownerOnChain === ownerWallet && ['DELIVERED', 'RENT_OVERDUE'].includes(order.status)) {
        // قفل ضد دوبار تسویه: فقط یک درخواست می‌تواند وضعیت را به DONE ببرد
        const lock = await db.order.updateMany({ where: { id: order.id, status: { in: ['DELIVERED', 'RENT_OVERDUE'] } }, data: { status: 'DONE' } });
        if (lock.count !== 1) return Response.json({ ok: true, status: 'DONE', verified: true });
        const s = await getSettings();
        const fee = calcFee(order.amountTon, feePercentOf(s, 'rent'));
        const net = Math.round((order.amountTon - fee) * 1e9) / 1e9;
        let released = false;
        if (order.payMethod === 'wallet' && order.userId) {
          const sellerUser = await db.user.findFirst({ where: { wallet: order.sellerWallet } });
          if (sellerUser) {
            const bal = await creditBalance(sellerUser.id, net, 'RELEASE', { orderId: order.id, note: `تسویهٔ اجارهٔ ${order.title}` });
            released = bal >= 0;
          }
        }
        const feeRec = await db.feeRecord.findFirst({ where: { orderId: order.id } });
        if (feeRec) await db.feeRecord.update({ where: { id: feeRec.id }, data: { status: released || order.payMethod !== 'wallet' ? 'PAID' : 'PENDING' } });
        return Response.json({ ok: true, status: 'DONE', verified: true, released });
      }
      // مهلت تمام شد و NFT هرگز تحویل نشد → بازگشت مبلغ امانی به اجاره‌گیرنده
      if (expired && order.status === 'RENT_ACTIVE' && order.payMethod === 'wallet' && order.userId) {
        const lock = await db.order.updateMany({ where: { id: order.id, status: 'RENT_ACTIVE' }, data: { status: 'REFUNDED' } });
        if (lock.count === 1) {
          await creditBalance(order.userId, order.amountTon, 'REFUND', { orderId: order.id, note: `بازگشت مبلغ — آیتم تحویل داده نشد: ${order.title}` });
          const feeRec = await db.feeRecord.findFirst({ where: { orderId: order.id } });
          if (feeRec) await db.feeRecord.update({ where: { id: feeRec.id }, data: { status: 'CANCELLED' } });
        }
        return Response.json({ ok: true, status: 'REFUNDED', verified: true, notice: 'آیتم تحویل داده نشد؛ مبلغ به کیف پول شما برگشت' });
      }
      if (expired && order.status === 'DELIVERED') {
        await db.order.updateMany({ where: { id: order.id, status: 'DELIVERED' }, data: { status: 'RENT_OVERDUE' } });
        return Response.json({ ok: true, status: 'RENT_OVERDUE', verified: true, notice: 'مهلت اجاره تمام شده — آیتم را بازگردانید' });
      }
      return Response.json({ ok: true, status: order.status, verified: false });
    }

    // ---------------- تمدید / لغو / اجاره‌دادن (مارکت‌اپ) ----------------
    if (op === 'extend') {
      const nft = String(body.nft_address || '');
      const r = await maFetch<SendTx>(`/v1/rent/${nft}/extend/`, {
        method: 'POST',
        body: { duration: Number(body.duration || 0), price_per_day: String(body.price_per_day || '') },
      });
      if (r.status !== 200 || !r.body?.messages) {
        const b = r.body as { detail?: string } | null;
        return Response.json({ ok: false, detail: safeDetail(b?.detail || 'تمدید در دسترس نیست') }, { status: r.status === 0 ? 502 : r.status });
      }
      return Response.json({ ok: true, tx: r.body });
    }

    if (op === 'cancel') {
      const r = await maFetch<SendTx>('/v1/rent/cancel/', { method: 'POST', body: { nft_addresses: body.nft_addresses || [body.nft_address] } });
      if (r.status !== 200 || !r.body?.messages) {
        const b = r.body as { detail?: string } | null;
        return Response.json({ ok: false, detail: safeDetail(b?.detail || 'لغو ممکن نشد') }, { status: r.status === 0 ? 502 : r.status });
      }
      return Response.json({ ok: true, tx: r.body });
    }

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
        return Response.json({ ok: false, detail: safeDetail(b?.detail || 'اجاره‌دادن در دسترس نیست') }, { status: r.status === 0 ? 502 : r.status });
      }
      return Response.json({ ok: true, tx: r.body });
    }

    return Response.json({ ok: false, detail: 'اکشن نامشخص' }, { status: 404 });
  } catch (e) {
    return Response.json({ ok: false, detail: safeDetail((e as Error).message) }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const op = action[0];
  const sp = req.nextUrl.searchParams;

  try {
    if (op === 'my') {
      // اجاره‌های فعال من: مارکت‌اپ + سفارش‌های محلی خودم
      const user = await getSessionUser();
      let local: unknown[] = [];
      if (user) {
        const rows = await db.order.findMany({
          where: { userId: user.id, kind: { in: ['local_rent', 'rent'] } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        local = rows.map((o) => ({
          order_id: o.id,
          nft_name: o.title,
          nft_address: o.nftAddress,
          amount_ton: o.amountTon,
          status: o.status,
          pay_method: o.payMethod,
          end_time: o.endAt ? Math.floor(o.endAt.getTime() / 1000) : null,
          is_local: o.kind === 'local_rent',
        }));
      }
      // اجاره‌های حساب صاحب توکن API فقط برای مدیر دیده می‌شود
      let remote: unknown[] = [];
      if (user?.role === 'ADMIN') {
        const r = await maFetch<{ items?: unknown[] }>('/v1/rent/my-rented/', { query: { limit: 50 } });
        remote = r.body?.items || [];
      }
      return Response.json({ items: [...local, ...remote] });
    }

    if (op === 'orders') {
      // سفارش‌های اجاره‌ای مرتبط با کاربر (به‌عنوان اجاره‌گیرنده یا مالک)
      const user = await getSessionUser();
      if (!user?.wallet) return Response.json({ orders: [] });
      const rows = await db.order.findMany({
        where: {
          OR: [{ userId: user.id, kind: 'local_rent' }, { sellerWallet: user.wallet, kind: 'local_rent' }],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      const out = await Promise.all(
        rows.map(async (o) => {
          const renter = o.userId ? await db.user.findUnique({ where: { id: o.userId } }) : null;
          return {
            id: o.id,
            title: o.title,
            amountTon: o.amountTon,
            feeTon: o.feeTon,
            status: o.status,
            payMethod: o.payMethod,
            nftAddress: o.nftAddress,
            sellerWallet: o.sellerWallet,
            endAt: o.endAt,
            role: (o.sellerWallet || '').toLowerCase() === user.wallet!.toLowerCase() ? 'owner' : 'renter',
            renterWallet: renter?.wallet || null,
            createdAt: o.createdAt,
          };
        }),
      );
      return Response.json({ orders: out });
    }

    if (op === 'history') {
      const category = ['gifts', 'usernames', 'numbers'].includes(sp.get('category') || '') ? sp.get('category') : 'gifts';
      const r = await maFetch<{ items?: unknown[] }>(`/v1/rent/${category}/history/`, { query: { limit: 20 } });
      return Response.json({ items: r.body?.items || [] });
    }
    return Response.json({ ok: false, detail: 'اکشن نامشخص' }, { status: 404 });
  } catch (e) {
    return Response.json({ ok: false, detail: safeDetail((e as Error).message) }, { status: 500 });
  }
}
