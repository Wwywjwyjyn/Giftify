import { NextRequest } from 'next/server';
import { maFetch } from '@/lib/marketapp';
import { fromNano } from '@/lib/format';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getSettings, feePercentOf } from '@/lib/settings';
import type { SendTx } from '@/lib/types';

/**
 * پراکسی کامل Fragment API مارکت‌اپ:
 *   POST /api/fragment/stars/price | stars/recipient | stars/buy
 *   POST /api/fragment/stars-giveaway/…  | premium/…  | premium-giveaway/…
 *   POST /api/fragment/ads/topup  | telegram-topup/recipient | telegram-topup/pay
 * اندپوینت‌های buy: سفارش + کارمزد شفاف ثبت می‌شود و تراکنش امضانشده به کیف پول کاربر برمی‌گردد.
 */
const SECTION_OF: Record<string, string> = {
  stars: 'stars',
  premium: 'premium',
  'stars-giveaway': 'giveaway',
  'premium-giveaway': 'giveaway',
  ads: 'ads',
  'telegram-topup': 'premium',
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const [group, action] = path;

  const body = await req.json().catch(() => ({}));

  // نگاشت مسیرها
  let maPath: string;
  let maBody: Record<string, unknown> = body;
  if (group === 'ads' && action === 'topup') {
    maPath = '/v1/fragment/ads-topup/pay/';
    maBody = { fragment_link: body.fragment_link, amount: Number(body.amount) || 0 };
  } else if (group === 'telegram-topup') {
    maPath = action === 'pay' ? '/v1/fragment/telegram-topup/pay/' : '/v1/fragment/telegram-topup/recipient/';
    if (action === 'pay') maBody = { username: String(body.username || '').replace(/^@/, ''), amount: Number(body.amount) || 0 };
  } else {
    maPath = `/v1/fragment/${group}/${action}/`;
  }

  const isBuy = action === 'buy' || action === 'topup' || (group === 'telegram-topup' && action === 'pay');
  const section = SECTION_OF[group] || 'gifts';

  const r = await maFetch<SendTx | Record<string, unknown>>(maPath, {
    method: 'POST',
    body: maBody,
  });

  // خطاها شفاف برمی‌گردند
  if (r.status !== 200 || !(r.body as SendTx)?.messages) {
    const b = r.body as { detail?: string } | null;
    return Response.json({ ok: false, detail: b?.detail || 'خطا در سرویس فرگمنت' }, { status: r.status === 0 ? 502 : r.status });
  }

  const tx = r.body as SendTx;

  if (!isBuy) {
    // price/recipient — پاس مستقیم
    return Response.json(r.body);
  }

  // ثبت سفارش + کارمزد شفاف
  try {
    const user = await getSessionUser();
    const settings = await getSettings();
    const amountTon = fromNano(tx.messages[0]?.amount || 0);
    const pct = feePercentOf(settings, section);
    const feeTon = Math.round(amountTon * pct) / 100;

    const clean = (s: unknown) => String(s ?? '').replace(/^@/, '');
    const titleBits: string[] = [];
    if (maBody.username) titleBits.push(`@${clean(maBody.username)}`);
    if (maBody.quantity) titleBits.push(`×${maBody.quantity}`);
    if (maBody.months) titleBits.push(`${maBody.months} ماه`);
    if (maBody.stars) titleBits.push(`${maBody.stars}★`);
    if (maBody.amount) titleBits.push(`${maBody.amount}`);
    if (maBody.fragment_link) titleBits.push(String(maBody.fragment_link).slice(0, 40));

    const order = await db.order.create({
      data: {
        userId: user?.id ?? null,
        kind: group === 'ads' ? 'ads' : group === 'stars-giveaway' ? 'stars_giveaway' : group === 'premium-giveaway' ? 'premium_giveaway' : group === 'telegram-topup' ? 'telegram_topup' : group,
        title: titleBits.join(' ') || group,
        amountTon,
        feeTon,
        currency: String(maBody.currency || 'TON'),
        status: 'PENDING_TX',
        meta: JSON.stringify({ section, path: maPath }),
      },
    });

    if (feeTon > 0 && settings.fee_wallet) {
      await db.feeRecord.create({
        data: { orderId: order.id, section, amountTon: feeTon, wallet: settings.fee_wallet, status: 'PENDING' },
      });
    }

    return Response.json({ ok: true, tx, orderId: order.id, amountTon, feeTon });
  } catch (e) {
    // حتی اگر ثبت سفارش خطا خورد، تراکنش را برمی‌گردانیم
    return Response.json({ ok: true, tx, detail: (e as Error).message });
  }
}
