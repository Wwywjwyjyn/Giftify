import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getSettings, feePercentOf } from '@/lib/settings';
import { spendBalance, calcFee } from '@/lib/wallet';
import { getStarsPriceTon, getPremiumPriceTon } from '@/lib/pricing';
import { maFetch } from '@/lib/marketapp';
import { fetchTelegramPage } from '@/lib/tgpage';
import type { SendTx } from '@/lib/types';
import { safeDetail } from '@/lib/errors';

/**
 * سفارش استارز/پرمیوم:
 *  - گیرنده با t.me واقعی resolve می‌شود (نام و عکس)
 *  - قیمت واقعی (مارکت‌اپ یا تنظیم ادمین)
 *  - پرداخت با کیف پول داخلی → سفارش در نوبت تحویل ادمین قرار می‌گیرد
 *  - اگر توکن مارکت‌اپ معتبر باشد، تراکنش مستقیم فرگمنت هم برمی‌گردد
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kind = body.kind === 'premium' ? 'premium' : 'stars';
    const user = await getSessionUser();
    const settings = await getSettings();

    const username = String(body.username || '').replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
    if (!username || username.length < 3) return Response.json({ ok: false, detail: 'یوزرنیم گیرنده را درست وارد کنید' }, { status: 400 });

    // گیرنده واقعی است؟ (از t.me)
    const info = await fetchTelegramPage(username);
    if (!info.exists) {
      return Response.json({ ok: false, detail: 'این یوزرنیم در تلگرام پیدا نشد — دوباره بررسی کنید' }, { status: 404 });
    }

    const qty = kind === 'stars' ? Math.max(50, Math.min(10_000_000, Number(body.qty || 0))) : 0;
    const months = kind === 'premium' ? (Number(body.months) || 3) : 0;
    if (kind === 'stars' && !qty) return Response.json({ ok: false, detail: 'مقدار استارز را انتخاب کنید' }, { status: 400 });
    if (kind === 'premium' && ![3, 6, 12].includes(months)) return Response.json({ ok: false, detail: 'مدت پرمیوم نامعتبر است' }, { status: 400 });

    const price = kind === 'stars' ? await getStarsPriceTon(qty) : await getPremiumPriceTon(months);
    if (!price || !(price.ton > 0)) return Response.json({ ok: false, detail: 'قیمت در دسترس نیست — دوباره تلاش کنید' }, { status: 502 });

    const pct = feePercentOf(settings, kind);
    const feeTon = calcFee(price.ton, pct);
    const title = kind === 'stars' ? `${qty.toLocaleString('en-US')} استارز برای @${username}` : `پرمیوم ${months} ماهه برای @${username}`;

    // پرداخت با کیف پول داخلی → نوبت تحویل ادمین
    const payWith: 'wallet' | 'ton' = body.pay_with === 'wallet' ? 'wallet' : 'ton';
    if (payWith === 'wallet') {
      if (!user) return Response.json({ ok: false, detail: 'برای خرید اول وارد شوید' }, { status: 401 });
      const bal = await spendBalance(user.id, price.ton, title);
      if (bal === null) return Response.json({ ok: false, detail: 'موجودی کیف پول کافی نیست — از صفحهٔ کیف پول شارژ کنید' }, { status: 400 });
      const order = await db.order.create({
        data: {
          userId: user.id,
          kind,
          title,
          amountTon: price.ton,
          feeTon,
          currency: 'TON',
          status: 'AWAITING_DELIVERY',
          payMethod: 'wallet',
          meta: JSON.stringify({ username, qty, months, recipient: info.title, section: kind }),
        },
      });
      if (feeTon > 0) {
        await db.feeRecord.create({ data: { orderId: order.id, section: kind, amountTon: feeTon, wallet: settings.fee_wallet || '(کیف پول داخلی)', status: 'PENDING' } });
      }
      return Response.json({
        ok: true,
        wallet_paid: true,
        orderId: order.id,
        balanceTon: bal,
        detail: `سفارش ثبت شد — ${title} در صف تحویل است (معمولاً کمتر از چند ساعت)`,
      });
    }

    // پرداخت با TON Connect — اگر مارکت‌اپ معتبر است تراکنش رسمی، وگرنه سفارش به کیف پذیرش سایت
    const r = await maFetch<SendTx>(`/v1/fragment/${kind}/buy/`, {
      method: 'POST',
      body: kind === 'stars' ? { username, quantity: qty, currency: 'TON' } : { username, months, currency: 'TON' },
    });
    if (r.status === 200 && (r.body as SendTx)?.messages) {
      const tx = r.body as SendTx;
      const order = await db.order.create({
        data: {
          userId: user?.id ?? null,
          kind,
          title,
          amountTon: price.ton,
          feeTon,
          currency: 'TON',
          status: 'PENDING_TX',
          payMethod: 'ton',
          meta: JSON.stringify({ username, qty, months, via: 'marketapp' }),
        },
      });
      if (feeTon > 0 && settings.fee_wallet) {
        await db.feeRecord.create({ data: { orderId: order.id, section: kind, amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' } });
      }
      return Response.json({ ok: true, tx, orderId: order.id });
    }

    // بدون توکن: پرداخت TON مستقیم به کیف پذیرش سایت (deposit/merchant wallet) و ثبت سفارش تحویل
    const target = settings.deposit_wallet || settings.fee_wallet;
    if (!target) {
      return Response.json({ ok: false, detail: 'پرداخت آنلاین هنوز تنظیم نشده — از کیف پول داخلی سایت استفاده کنید' }, { status: 400 });
    }
    const tx: SendTx = {
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [{ address: target, amount: String(Math.round(price.ton * 1e9)) }],
    };
    const order = await db.order.create({
      data: {
        userId: user?.id ?? null,
        kind,
        title,
        amountTon: price.ton,
        feeTon,
        currency: 'TON',
        status: 'PENDING_TX',
        payMethod: 'ton',
        meta: JSON.stringify({ username, qty, months, via: 'direct' }),
      },
    });
    if (feeTon > 0) {
      await db.feeRecord.create({ data: { orderId: order.id, section: kind, amountTon: feeTon, wallet: settings.fee_wallet || '(کیف پول داخلی)', status: 'PENDING' } });
    }
    return Response.json({ ok: true, tx, orderId: order.id });
  } catch (e) {
    return Response.json({ ok: false, detail: safeDetail((e as Error).message) }, { status: 500 });
  }
}
