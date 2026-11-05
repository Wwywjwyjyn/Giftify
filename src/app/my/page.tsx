'use client';

import { useEffect, useState } from 'react';
import { TonDiamond } from '@/components/ui-bits';
import { fmtTon } from '@/lib/format';

type Order = { id: string; kind: string; title: string; amountTon: number; feeTon: number; currency: string; status: string; createdAt: string };

const KIND_FA: Record<string, string> = {
  stars: 'استارز', premium: 'پرمیوم', stars_giveaway: 'گیوِی استارز', premium_giveaway: 'گیوِی پرمیوم',
  ads: 'تبلیغات', telegram_topup: 'شارژ تلگرام', nft: 'خرید NFT', rent: 'اجاره',
};
const STATUS_FA: Record<string, string> = { PENDING_TX: 'در انتظار تراکنش', TX_SENT: 'ارسال شد', DONE: 'تکمیل شد', FAILED: 'ناموفق' };

export default function MyPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [me, setMe] = useState<{ role?: string; wallet?: string; telegramId?: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((j) => setMe(j.user)).catch(() => {});
    fetch('/api/orders', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setOrders(j.orders || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="hero-title">تراکنش‌های من</h1>
      <p className="hero-sub mt-2">
        {me?.wallet
          ? `کیف پول: ${me.wallet.slice(0, 10)}…${me.wallet.slice(-6)}`
          : me?.telegramId
            ? `کاربر تلگرام: ${me.name || me.telegramId}`
            : 'وارد نشده‌اید'}
      </p>

      <div className="mt-6 space-y-3">
        {loading && <div className="flex justify-center py-10"><span className="spin" /></div>}
        {!loading && orders.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">هنوز تراکنشی ثبت نشده است</div>
        )}
        {orders.map((o) => (
          <div key={o.id} className="card flex items-center justify-between gap-3 p-4">
            <div>
              <div className="text-sm font-bold">{KIND_FA[o.kind] || o.kind} — {o.title}</div>
              <div className="mt-1 text-xs text-muted">{new Date(o.createdAt).toLocaleString('fa-IR')}</div>
            </div>
            <div className="text-end">
              <div className="whitespace-nowrap text-sm font-bold">
                <TonDiamond className="text-ton" /> {fmtTon(o.amountTon)} {o.currency === 'TON' ? 'TON' : o.currency}
              </div>
              {o.feeTon > 0 && <div className="text-[11px] text-muted">کارمزد {fmtTon(o.feeTon)} TON</div>}
              <div className={`text-[11px] font-bold ${o.status === 'FAILED' ? 'text-bad' : o.status === 'DONE' ? 'text-ok' : 'text-accent-hi'}`}>
                {STATUS_FA[o.status] || o.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
