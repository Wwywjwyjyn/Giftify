'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet2, RefreshCw, Copy, Check, ArrowDownToLine, History } from 'lucide-react';
import { fmtTon, faNum } from '@/lib/format';
import { refreshWalletBadge } from '@/components/WalletBox';

type WalletData = {
  balanceTon: number;
  memoCode: string;
  depositWallet: string | null;
  txs: { id: string; type: string; amountTon: number; balanceAfter: number; note: string; createdAt: string }[];
};

const TYPE_FA: Record<string, string> = {
  DEPOSIT: 'واریز',
  SPEND: 'خرید',
  CREDIT: 'دریافت',
  FEE: 'کارمزد',
  REFUND: 'بازگشت مبلغ',
  HOLD: 'امانی',
  RELEASE: 'تسویه',
};

const TYPE_COLOR: Record<string, string> = {
  DEPOSIT: 'text-ok',
  CREDIT: 'text-ok',
  REFUND: 'text-ok',
  RELEASE: 'text-ok',
  SPEND: 'text-bad',
  FEE: 'text-[#FBBF24]',
  HOLD: 'text-muted',
};

export default function WalletPage() {
  const [w, setW] = useState<WalletData | null>(null);
  const [me, setMe] = useState<{ wallet?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    try {
      const [rw, rm] = await Promise.all([fetch('/api/wallet').then((r) => r.json()), fetch('/api/auth/me').then((r) => r.json())]);
      setW(rw.wallet || null);
      setMe(rm.user || null);
    } catch {
      /* شبکه */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // بعد از ورود، یک بررسی خودکار واریز هم انجام می‌شود
    const t = setTimeout(() => checkDeposits(true), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkDeposits(silent = false) {
    if (!silent) setChecking(true);
    setMsg(null);
    try {
      const r = await fetch('/api/wallet', { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        if (!silent) setMsg({ ok: false, text: j.detail || 'بررسی واریزی ممکن نشد' });
        return;
      }
      if (j.credited?.length) {
        setMsg({ ok: true, text: `واریزی جدید تأیید شد — موجودی: ${j.balanceTon.toLocaleString('en-US')} TON ✓` });
        refreshWalletBadge();
      } else if (j.error) {
        if (!silent) setMsg({ ok: false, text: j.error });
      } else if (!silent) {
        setMsg({ ok: true, text: 'واریز جدیدی پیدا نشد — بعد از ارسال، چند دقیقه صبر کنید و دوباره بررسی کنید' });
      }
      await load();
    } catch {
      if (!silent) setMsg({ ok: false, text: 'اتصال برقرار نشد — دوباره تلاش کنید' });
    } finally {
      setChecking(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    }).catch(() => {});
  }

  if (loading) {
    return <div className="flex justify-center py-20"><span className="spin" /></div>;
  }

  if (!w) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="card p-10 text-sm leading-7 text-muted">
          برای دیدن کیف پول، اول وارد شوید — از دکمهٔ «اتصال کیف پول» بالای صفحه.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="hero-title">کیف پول من</h1>
      <p className="hero-sub mt-2">موجودی گرام داخل سایت — برای خرید، اجاره، استارز و پرمیوم استفاده می‌شود.</p>

      {/* موجودی */}
      <div className="card mt-6 p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          <Wallet2 size={16} /> موجودی فعلی
        </div>
        <div className="mt-2 text-4xl font-black tabular">{w.balanceTon.toLocaleString('en-US', { maximumFractionDigits: 4 })}</div>
        <div className="text-xs text-muted">TON (گرام)</div>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-ghost btn-sm" onClick={() => checkDeposits()} disabled={checking}>
            <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
            {checking ? 'در حال بررسی…' : 'بررسی واریزی‌ها'}
          </button>
          <Link href="/inventory" className="btn-ghost btn-sm">انباری من</Link>
        </div>
      </div>

      {msg && (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-xs leading-6 ${msg.ok ? 'border-ok/30 bg-ok/10 text-ok' : 'border-bad/30 bg-bad/10 text-bad'}`}>
          {msg.text}
        </div>
      )}

      {/* واریز */}
      <div className="card mt-5 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ArrowDownToLine size={15} className="text-ok" /> شارژ کیف پول (واریز گرام)
        </h2>
        {w.depositWallet ? (
          <>
            <p className="mt-2 text-xs leading-6 text-muted">
              مقدار دلخواه TON را از کیف پول خودتان به آدرس زیر بفرستید و کد یادمان را در کامنت/یادداشت تراکنش قرار دهید
              (یا از همان کیف پولی بفرستید که با آن وارد شده‌اید). موجودی به‌صورت خودکار تشخیص داده می‌شود.
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-panel2 px-3 py-2.5" dir="ltr">
                <code className="min-w-0 flex-1 truncate text-[11px] text-ink">{w.depositWallet}</code>
                <button className="btn-ghost btn-sm shrink-0" onClick={() => copy(w.depositWallet!, 'addr')}>
                  {copied === 'addr' ? <Check size={12} className="text-ok" /> : <Copy size={12} />} کپی
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5" dir="ltr">
                <span className="text-[10px] font-bold text-accent-hi">MEMO</span>
                <code className="min-w-0 flex-1 truncate text-sm font-black tracking-wider text-accent-hi">{w.memoCode}</code>
                <button className="btn-ghost btn-sm shrink-0" onClick={() => copy(w.memoCode, 'memo')}>
                  {copied === 'memo' ? <Check size={12} className="text-ok" /> : <Copy size={12} />} کپی
                </button>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-panel2 px-3 py-2 text-[11px] leading-6 text-muted">
              حداقل واریز پیشنهادی: ۰٫۱ TON — کارمزد شبکه را کیف پول ارسال‌کننده می‌پردازد. مشکل در واریز؟
              <a href="https://t.me/ItsBenyaminM" target="_blank" rel="noreferrer" className="mx-1 text-accent-hi hover:underline">پشتیبانی</a>
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-xs leading-6 text-[#FBBF24]">
            کیف واریز هنوز توسط مدیریت تنظیم نشده است — به‌زودی فعال می‌شود. تا آن موقع می‌توانید با TON Connect مستقیم خرید کنید.
          </div>
        )}
      </div>

      {/* اتصال کیف پول زنجیره */}
      <div className="card mt-4 p-5">
        <h2 className="text-sm font-bold">کیف پول زنجیره (TON Connect)</h2>
        <p className="mt-1 text-xs leading-6 text-muted">
          {me?.wallet
            ? <>متصل: <span dir="ltr" className="tabular">{me.wallet.slice(0, 10)}…{me.wallet.slice(-6)}</span> — خریدهای TON با همین کیف انجام می‌شود.</>
            : 'برای خرید مستقیم با TON، از دکمهٔ «اتصال کیف پول» بالای صفحه استفاده کنید.'}
        </p>
      </div>

      {/* تاریخچه */}
      <div className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><History size={15} /> تراکنش‌های اخیر</h2>
        {w.txs.length === 0 ? (
          <div className="card p-8 text-center text-xs text-muted">هنوز تراکنشی ثبت نشده است</div>
        ) : (
          <div className="card divide-y divide-[#121b26]">
            {w.txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold">{TYPE_FA[t.type] || t.type}{t.note ? ` — ${t.note}` : ''}</div>
                  <div className="mt-0.5 text-[10px] text-muted">{new Date(t.createdAt).toLocaleString('fa-IR')}</div>
                </div>
                <div className={`shrink-0 text-xs font-bold tabular ${TYPE_COLOR[t.type] || ''}`}>
                  {['SPEND', 'FEE'].includes(t.type) ? '−' : '+'}
                  {fmtTon(t.amountTon)} TON
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
