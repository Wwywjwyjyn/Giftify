'use client';

import { useTonConnectUI } from '@tonconnect/ui-react';
import { useCallback, useState } from 'react';

export type SendTx = {
  validUntil: number;
  messages: { address: string; amount: string; payload?: string | null; stateInit?: string | null }[];
};

export type PurchaseResult = { ok: boolean; orderId?: string; detail?: string };

/** جریان خرید: از سرور تراکنش امضانشده می‌گیریم، کاربر با کیف پول خودش امضا و ارسال می‌کند */
export function usePurchase() {
  const [tonConnectUI] = useTonConnectUI();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const purchase = useCallback(
    async (endpoint: string, body: Record<string, unknown>, feeNote?: string): Promise<PurchaseResult> => {
      setBusy(true);
      setError('');
      setSuccess('');
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok || !j.ok) {
          setError(j.detail || 'خطا در آماده‌سازی تراکنش');
          return { ok: false, detail: j.detail };
        }
        const tx = j.tx as SendTx;
        const orderId = j.orderId as string | undefined;
        if (feeNote) setSuccess(feeNote);

        // ارسال با کیف پول کاربر
        await tonConnectUI.sendTransaction({
          validUntil: tx.validUntil,
          messages: tx.messages.map((m) => ({
            address: m.address,
            amount: m.amount,
            ...(m.payload ? { payload: m.payload } : {}),
            ...(m.stateInit ? { stateInit: m.stateInit } : {}),
          })),
        });

        await fetch('/api/fragment/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        setSuccess('تراکنش ارسال شد ✓ — پس از تأیید شبکه تکمیل می‌شود');
        return { ok: true, orderId };
      } catch (e) {
        const msg = (e as Error)?.message || 'تراکنش لغو شد';
        setError(msg === 'Transaction was not sent' ? 'تراکنش لغو شد' : msg);
        return { ok: false, detail: msg };
      } finally {
        setBusy(false);
      }
    },
    [tonConnectUI],
  );

  return { purchase, busy, error, success, setError, setSuccess };
}
