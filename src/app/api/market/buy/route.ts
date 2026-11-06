import { NextRequest } from 'next/server';
import { maFetch } from '@/lib/marketapp';
import { fromNano } from '@/lib/format';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getSettings, feePercentOf } from '@/lib/settings';
import { spendBalance, creditBalance, calcFee } from '@/lib/wallet';
import { salePriceNano, saleContractAddress, getNft } from '@/lib/tonapi';
import { buildBuyTx, toRawAddress } from '@/lib/nfttx';
import type { SendTx } from '@/lib/types';
import { safeDetail } from '@/lib/errors';

/**
 * خرید:
 *  A) لیستینگ محلی سایت — پرداخت با کیف پول داخلی یا TON Connect
 *  B) NFT واقعی روی زنجیره (فرگمنت) — تراکنش مستقیم به قرارداد فروش + کارمزد
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getSessionUser();
    const settings = await getSettings();
    const payWith: 'wallet' | 'ton' = body.pay_with === 'wallet' ? 'wallet' : 'ton';

    // ---------- A) لیستینگ محلی ----------
    if (body.local_id) {
      const listing = await db.localListing.findUnique({ where: { id: String(body.local_id) } });
      if (!listing || !listing.priceTon) return Response.json({ ok: false, detail: 'لیستینگ یافت نشد یا فروخته شده' }, { status: 404 });
      if (!user) return Response.json({ ok: false, detail: 'برای خرید اول وارد شوید' }, { status: 401 });
      if (toRawAddress(user.wallet) && toRawAddress(user.wallet) === toRawAddress(listing.ownerWallet)) {
        return Response.json({ ok: false, detail: 'این آیتم از آنِ خود شماست' }, { status: 400 });
      }

      const pct = feePercentOf(settings, 'gifts');
      const feeTon = calcFee(listing.priceTon, pct);
      const total = listing.priceTon;

      if (payWith === 'wallet') {
        // خرید با موجودی کیف پول داخلی: کسر از خریدار → واریز به فروشنده → کارمزد جدا ثبت می‌شود
        const bal = await spendBalance(user.id, total, `خرید ${listing.name}`, undefined);
        if (bal === null) {
          return Response.json({ ok: false, detail: 'موجودی کیف پول کافی نیست — از صفحهٔ کیف پول شارژ کنید' }, { status: 400 });
        }
        const sellerUser = await db.user.findFirst({ where: { wallet: listing.ownerWallet } });
        let sellerNet = total - feeTon;
        if (sellerUser) {
          const credited = await creditBalance(sellerUser.id, sellerNet, 'CREDIT', { note: `فروش ${listing.name}` });
          if (credited < 0) sellerNet = 0;
        }
        const order = await db.order.create({
          data: {
            userId: user.id,
            kind: 'local_buy',
            title: listing.name,
            amountTon: total,
            feeTon,
            currency: 'TON',
            status: sellerUser ? 'DELIVERED' : 'AWAITING_DELIVERY',
            payMethod: 'wallet',
            nftAddress: listing.nftAddress || null,
            sellerWallet: listing.ownerWallet,
            meta: JSON.stringify({ local: true, listingId: listing.id, sellerNet }),
          },
        });
        // آیتم فروخته شد — از بازار برداشته شود (فروش تکراری ممکن نیست)
        await db.localListing.update({ where: { id: listing.id }, data: { status: 'INACTIVE' } }).catch(() => {});
        if (feeTon > 0) {
          await db.feeRecord.create({
            data: { orderId: order.id, section: 'gifts', amountTon: feeTon, wallet: settings.fee_wallet || '(کیف پول داخلی)', status: sellerUser ? 'PAID' : 'PENDING' },
          });
        }
        return Response.json({
          ok: true,
          wallet_paid: true,
          orderId: order.id,
          balanceTon: bal,
          detail: 'خرید با موفقیت انجام شد — آیتم به انباری شما اضافه شد',
        });
      }

      // خرید با TON Connect: یک تراکنش با دو خروجی (فروشنده + کیف کارمزد) — واریز کارمزد واقعی
      const priceNano = String(Math.round(listing.priceTon * 1e9));
      const feeNano = String(Math.round(feeTon * 1e9));
      const messages: SendTx['messages'] = [{ address: listing.ownerWallet, amount: priceNano }];
      if (feeNano !== '0' && settings.fee_wallet) messages.push({ address: settings.fee_wallet, amount: feeNano });

      const tx: SendTx = { validUntil: Math.floor(Date.now() / 1000) + 600, messages };
      const order = await db.order.create({
        data: {
          userId: user?.id ?? null,
          kind: 'local_buy',
          title: listing.name,
          amountTon: listing.priceTon,
          feeTon,
          currency: 'TON',
          status: 'PENDING_TX',
          payMethod: 'ton',
          nftAddress: listing.nftAddress || null,
          sellerWallet: listing.ownerWallet,
          meta: JSON.stringify({ local: true, listingId: listing.id }),
        },
      });
      if (feeTon > 0 && settings.fee_wallet) {
        await db.feeRecord.create({ data: { orderId: order.id, section: 'gifts', amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' } });
      }
      return Response.json({ ok: true, tx, orderId: order.id });
    }

    // ---------- B) NFT واقعی روی زنجیره ----------
    const nftAddress = String(body.nft_address || '');
    if (!nftAddress) return Response.json({ ok: false, detail: 'آدرس آیتم لازم است' }, { status: 400 });
    if (!user) return Response.json({ ok: false, detail: 'برای خرید اول وارد شوید' }, { status: 401 });

    // قیمت واقعی از زنجیره — کلاینت قابل دستکاری نیست
    const item = await getNft(nftAddress);
    const priceNano = item ? salePriceNano(item) : null;
    const saleAddr = item ? saleContractAddress(item) : null;
    const clientPrice = String(body.price || '');
    const finalPriceNano = priceNano && priceNano !== '0' ? priceNano : clientPrice;
    if (!finalPriceNano || finalPriceNano === '0') {
      return Response.json({ ok: false, detail: 'این آیتم الان برای فروش روی زنجیره نیست' }, { status: 400 });
    }

    const priceTon = fromNano(finalPriceNano);
    const pct = feePercentOf(settings, 'gifts');
    const feeTon = calcFee(priceTon, pct);

    if (payWith === 'wallet') {
      // خرید از موجودی: مبلغ از کیف کاربر کسر می‌شود؛ سایت خودش خرید را انجام می‌دهد (تحویل با انتقال واقعی NFT)
      const bal = await spendBalance(user.id, priceTon, 'خرید NFT از زنجیره');
      if (bal === null) return Response.json({ ok: false, detail: 'موجودی کیف پول کافی نیست — از صفحهٔ کیف پول شارژ کنید' }, { status: 400 });
      const order = await db.order.create({
        data: {
          userId: user.id,
          kind: 'nft',
          title: item?.metadata?.name || nftAddress.slice(0, 14) + '…',
          amountTon: priceTon,
          feeTon,
          currency: 'TON',
          status: 'AWAITING_DELIVERY',
          payMethod: 'wallet',
          nftAddress,
          meta: JSON.stringify({ nft: nftAddress, onchain: true, sale: saleAddr || '' }),
        },
      });
      if (feeTon > 0) {
        await db.feeRecord.create({ data: { orderId: order.id, section: 'gifts', amountTon: feeTon, wallet: settings.fee_wallet || '(کیف پول داخلی)', status: 'PENDING' } });
      }
      return Response.json({
        ok: true,
        wallet_paid: true,
        orderId: order.id,
        balanceTon: bal,
        detail: 'پرداخت انجام شد — تحویل NFT با انتقال واقعی روی زنجیره انجام می‌شود',
      });
    }

    // خرید با TON Connect — تراکنش واقعی به قرارداد فروش (+ پیام کارمزد)
    if (!saleAddr && !clientPrice) {
      return Response.json({ ok: false, detail: 'قرارداد فروش روی زنجیره پیدا نشد — صفحه را دوباره باز کنید' }, { status: 400 });
    }
    const target = saleAddr || nftAddress;
    const tx = buildBuyTx({
      saleAddress: target,
      priceNano: finalPriceNano,
      feeWallet: settings.fee_wallet || null,
      feeNano: String(Math.round(feeTon * 1e9)),
    });
    const order = await db.order.create({
      data: {
        userId: user.id,
        kind: 'nft',
        title: item?.metadata?.name || nftAddress.slice(0, 14) + '…',
        amountTon: priceTon,
        feeTon,
        currency: 'TON',
        status: 'PENDING_TX',
        payMethod: 'ton',
        nftAddress,
        meta: JSON.stringify({ nft: nftAddress, onchain: true }),
      },
    });
    if (feeTon > 0 && settings.fee_wallet) {
      await db.feeRecord.create({ data: { orderId: order.id, section: 'gifts', amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' } });
    }
    return Response.json({ ok: true, tx, orderId: order.id });
  } catch (e) {
    return Response.json({ ok: false, detail: safeDetail((e as Error).message) }, { status: 500 });
  }
}
