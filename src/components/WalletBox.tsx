'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import Link from 'next/link';
import { Shield, LogOut } from 'lucide-react';

type Me = { id: number; role: 'ADMIN' | 'USER'; name?: string | null; wallet?: string | null; telegramId?: string | null } | null;

/** جعبه ورود: اتصال کیف پول + ورود خودکار داخل تلگرام (Mini App) */
export function WalletBox() {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const [me, setMe] = useState<Me>(null);
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

  useEffect(() => {
    loadMe();
    // ورود خودکار داخل تلگرام Mini App
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
      } catch {
        /* در لود بعدی دریافت می‌شود */
      } finally {
        busy.current = false;
      }
    });
    return () => off();
  }, [tonConnectUI]);

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
    <div className="flex items-center gap-2">
      {me?.role === 'ADMIN' && (
        <Link href="/admin" className="hidden items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:text-accent sm:flex">
          <Shield size={13} /> مدیریت
        </Link>
      )}
      <button onClick={onWalletClick} className="btn-primary btn-sm" title={short || undefined}>
        {me?.wallet || address ? <LogOut size={13} /> : null}
        {label}
      </button>
    </div>
  );
}
