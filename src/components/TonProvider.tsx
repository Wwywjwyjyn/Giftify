'use client';

import { useEffect } from 'react';
import { TonConnectUIProvider, useTonConnectUI } from '@tonconnect/ui-react';

/** نام دامنه فعلی برای مانیفست TON Connect (یا از env) */
function manifestUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, '')}/tonconnect-manifest.json`;
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) return `${origin}/tonconnect-manifest.json`;
  }
  return 'https://example.org/tonconnect-manifest.json';
}

/** درخواست ton_proof از کیف پول هنگام اتصال (برای تأیید مالکیت آدرس سمت سرور) */
function ProofRequester() {
  const [tonConnectUI] = useTonConnectUI();
  useEffect(() => {
    try {
      tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: String(Date.now()) } });
    } catch { /* کیف پول‌های قدیمی */ }
  }, [tonConnectUI]);
  return null;
}

export function TonProvider({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl()}>
      <ProofRequester />
      {children}
    </TonConnectUIProvider>
  );
}

