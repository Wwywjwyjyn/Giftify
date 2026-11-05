'use client';

import { useEffect, useState } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import Link from 'next/link';
import { Wallet, Send } from 'lucide-react';

export default function LoginPage() {
  const address = useTonAddress();
  const [me, setMe] = useState<{ role?: string; wallet?: string; telegramId?: string } | null>(null);
  const [inTg, setInTg] = useState(false);
  const [botUser, setBotUser] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((j) => setMe(j.user)).catch(() => {});
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    setInTg(!!tg?.initData);
    fetch('/api/settings').then((r) => r.json()).then((j) => setBotUser(j.telegram_bot_username || '')).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-5 py-8">
      <h1 className="hero-title">ورود به گیفتیفای</h1>
      <p className="hero-sub">بدون فرم ثبت‌نام — با اتصال کیف پول TON وارد شوید یا داخل تلگرام به‌صورت خودکار شناسایی شوید.</p>

      <div className="card p-6">
        <div className="mb-3 flex items-center gap-2 font-bold">
          <Wallet size={18} className="text-accent-hi" /> اتصال کیف پول TON
        </div>
        <p className="text-sm leading-7 text-muted">
          دکمه «اتصال کیف پول» در بالای صفحه را بزنید و Tonkeeper یا کیف پول دلخواه خود را وصل کنید.
          اتصال شما با امضای رمزنگاری‌شده (ton_proof) تأیید می‌شود.
        </p>
        {address && (
          <div className="mt-3 rounded-lg bg-panel2 px-4 py-2.5 text-xs" dir="ltr">
            {me?.wallet || address}
          </div>
        )}
        {me?.role === 'ADMIN' && (
          <div className="mt-3 rounded-lg border border-ok/30 bg-ok/10 px-4 py-2.5 text-xs text-ok">
            شما مدیر سایت هستید — <Link href="/admin" className="font-bold underline">پنل مدیریت</Link>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="mb-3 flex items-center gap-2 font-bold">
          <Send size={18} className="text-[#2EA6FF]" /> ورود با تلگرام (Mini App)
        </div>
        {inTg ? (
          <p className="text-sm text-ok">داخل تلگرام هستید — ورود خودکار انجام می‌شود. ✓</p>
        ) : (
          <p className="text-sm leading-7 text-muted">
            ربات {botUser ? <span dir="ltr" className="font-bold text-ink">@{botUser}</span> : 'سایت'} را باز کنید و دکمه Mini App را بزنید؛
            ورود به‌صورت خودکار و امن با امضای تلگرام انجام می‌شود.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-line bg-panel2 px-4 py-3 text-xs leading-6 text-muted">
        نکته مهم: اولین کاربری که وارد سایت شود، به‌طور خودکار دسترسی مدیریت (پنل کارمزدها و تنظیمات) را می‌گیرد.
      </div>
    </div>
  );
}
