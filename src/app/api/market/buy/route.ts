import { NextRequest } from 'next/server';
import { maFetch } from '@/lib/marketapp';
import { fromNano } from '@/lib/format';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getSettings, feePercentOf } from '@/lib/settings';
import type { SendTx } from '@/lib/types';

/** خرید NFT از فید فروش مارکت‌اپ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // خرید لیستینگ محلی: پرداخت مستقیم به فروشنده + کارمزد سایت در یک تراکنش
    if (body.local_id) {
      const listing = await db.localListing.findUnique({ where: { id: String(body.local_id) } });
      if (!listing || !listing.priceTon) return Response.json({ ok: false, detail: 'لیستینگ یافت نشد' }, { status: 404 });
      const settings = await getSettings();
      if (!settings.fee_wallet) return Response.json({ ok: false, detail: 'کیف پول کارمزد در پنل مدیریت تنظیم نشده است' }, { status: 400 });

      const priceNano = String(Math.round(listing.priceTon * 1e9));
      const feeNano = String(Math.round(((listing.priceTon * feePercentOf(settings, 'gifts')) / 100) * 1e9));
      const user = await getSessionUser();

      const tx: SendTx = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          { address: listing.ownerWallet, amount: priceNano },
          { address: settings.fee_wallet, amount: feeNano },
        ],
      };
      const feeTon = Number((Number(feeNano) / 1e9).toFixed(9));
      const order = await db.order.create({
        data: {
          userId: user?.id ?? null,
          kind: 'nft',
          title: `${listing.name} (لیستینگ سایت)`,
          amountTon: listing.priceTon,
          feeTon,
          currency: 'TON',
          status: 'PENDING_TX',
          meta: JSON.stringify({ local: true, listingId: listing.id }),
        },
      });
      await db.feeRecord.create({
        data: { orderId: order.id, section: 'gifts', amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' },
      });
      return Response.json({ ok: true, tx, orderId: order.id });
    }

    // خرید NFT واقعی از مارکت‌اپ
    const nftAddress = String(body.nft_address || '');
    const price = Number(body.price || 0);
    const currency = String(body.currency || 'TON');
    if (!nftAddress || !price) return Response.json({ ok: false, detail: 'پارامترهای خرید ناقص است' }, { status: 400 });

    const r = await maFetch<SendTx>('/v1/nfts/buy/', {
      method: 'POST',
      body: { data: [{ nft_address: nftAddress, price, currency }] },
    });
    if (r.status !== 200 || !r.body?.messages) {
      const b = r.body as { detail?: string } | null;
      return Response.json({ ok: false, detail: b?.detail || 'خرید در دسترس نیست (نیازمند پلن API)' }, { status: r.status === 0 ? 502 : r.status });
    }

    const user = await getSessionUser();
    const settings = await getSettings();
    const amountTon = fromNano(r.body.messages[0]?.amount || 0);
    const feeTon = Math.round(amountTon * feePercentOf(settings, 'gifts')) / 100;
    const order = await db.order.create({
      data: {
        userId: user?.id ?? null,
        kind: 'nft',
        title: nftAddress.slice(0, 14) + '…',
        amountTon,
        feeTon,
        currency,
        status: 'PENDING_TX',
        meta: JSON.stringify({ nft: nftAddress }),
      },
    });
    if (feeTon > 0 && settings.fee_wallet) {
      await db.feeRecord.create({ data: { orderId: order.id, section: 'gifts', amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' } });
    }
    return Response.json({ ok: true, tx: r.body, orderId: order.id });
  } catch (e) {
    return Response.json({ ok: false, detail: (e as Error).message }, { status: 500 });
  }
}
