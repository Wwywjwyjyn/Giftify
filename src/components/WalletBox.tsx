'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import Link from 'next/link';
import { Shield, LogOut, Wallet2 } from 'lucide-react';

type Me = { id: number; role: 'ADMIN' | 'USER'; name?: string | null; wallet?: string | null; telegramId?: string | null } | null;

/** رویداد سراسری: بعد از هر خرید/واریز، موجودی هدر تازه شود */
export function refreshWalletBadge() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('giftify:wallet-refresh'));
}

/** جعبه ورود: اتصال کیف پول + موجودی سایت + ورود خودکار داخل تلگرام (Mini App) */
export function WalletBox() {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const [me, setMe] = useState<Me>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const busy = useRef(false);
  const tgDone = useRef(false);

  const loadMe = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' });
      const j = await r.json();
      setMe(j.user ?? null);
    } catch {
      setMe(null);
    }
  }, []);

  const loadBalance = useCallback(async () => {
    try {
      const r = await fetch('/api/wallet', { cache: 'no-store' });
      const j = await r.json();
      setBalance(j.wallet ? j.wallet.balanceTon : null);
    } catch {
      /* بی‌اهمیت */
    }
  }, []);

  useEffect(() => {
    loadMe();
    loadBalance();
    const onR = () => loadBalance();
    window.addEventListener('giftify:wallet-refresh', onR);
    return () => window.removeEventListener('giftify:wallet-refresh', onR);
  }, [loadMe, loadBalance]);

  // ورود خودکار داخل تلگرام Mini App
  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } } }).Telegram?.WebApp;
    if (tg?.initData && !tgDone.current) {
      tgDone.current = true;
      tg.ready?.();
      tg.expand?.();
      fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      }).then(loadMe).catch(() => {});
    }
  }, [loadMe]);

  // اتصال کیف پول → ساخت نشست سمت سرور با ton_proof
  useEffect(() => {
    const off = tonConnectUI.onStatusChange(async (w) => {
      if (!w?.account?.address || busy.current) return;
      busy.current = true;
      try {
        const proof = w.connectItems?.tonProof ?? null;
        const r = await fetch('/api/auth/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: w.account.address, proof }),
        });
        const j = await r.json();
        setMe(j.user ?? null);
        loadBalance();
      } catch {
        /* در لود بعدی دریافت می‌شود */
      } finally {
        busy.current = false;
      }
    });
    return () => off();
  }, [tonConnectUI, loadBalance]);

  async function onWalletClick() {
    if (address || me?.wallet) {
      await tonConnectUI.disconnect();
      await fetch('/api/auth/logout', { method: 'POST' });
      setMe(null);
      return;
    }
    await tonConnectUI.openModal();
  }

  const short = (me?.wallet || address || '').replace(/^0:/, '');
  const label = me?.wallet || address ? `${short.slice(0, 4)}…${short.slice(-4)}` : 'اتصال کیف پول';

  return (
    <div className="flex items-center gap-1.5">
      {me?.role === 'ADMIN' && (
        <Link href="/admin" className="hidden items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:text-accent sm:flex">
          <Shield size={13} /> مدیریت
        </Link>
      )}
      {/* موجودی کیف پول داخلی */}
      {balance !== null && (
        <Link
          href="/wallet"
          className="flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1.5 text-xs font-bold text-accent-hi transition-colors hover:border-accent"
          title="کیف پول سایت — موجودی گرام"
        >
          <Wallet2 size={13} />
          <span className="tabular">{balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          <span className="text-[10px] opacity-75">TON</span>
        </Link>
      )}
      <button onClick={onWalletClick} className="btn-primary btn-sm" title={short || undefined}>
        {me?.wallet || address ? <LogOut size={13} /> : null}
        {label}
      </button>
    </div>
  );
}
