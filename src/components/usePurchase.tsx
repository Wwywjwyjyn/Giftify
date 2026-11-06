'use client';

import { useTonConnectUI } from '@tonconnect/ui-react';
import { useCallback, useState } from 'react';

export type SendTx = {
  validUntil: number;
  messages: { address: string; amount: string; payload?: string | null; stateInit?: string | null }[];
};

export type PurchaseResult = {
  ok: boolean;
  orderId?: string;
  walletPaid?: boolean;
  balanceTon?: number;
  detail?: string;
};

/** پیام‌های خطا برای کاربر عادی — بدون اصطلاح فنی */
function friendly(msg?: string): string {
  if (!msg) return 'خطای غیرمنتظره — دوباره تلاش کنید';
  const m = msg.toLowerCase();
  if (m.includes('موجودی') || m.includes('insufficient')) return msg;
  if (m.includes('transaction was not sent') || m.includes('user declined') || m.includes('cancel'))
    return 'پرداخت لغو شد — مبلغی از شما کسر نشده است';
  if (m.includes('timeout') || m.includes('abort')) return 'پاسخی دریافت نشد — دوباره تلاش کنید';
  if (m.includes('network') || m.includes('fetch')) return 'اتصال برقرار نشد — اینترنت را بررسی کنید';
  return msg;
}

/**
 * جریان خرید/پرداخت:
 *  - mode پیش‌فرض: تراکنش از سرور می‌آید و کاربر با TON Connect خودش امضا و ارسال می‌کند
 *  - mode کیف پول: مبلغ از موجودی داخلی سایت کسر می‌شود (بدون تراکنش روی زنجیره)
 */
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
          const msg = friendly(j.detail);
          setError(msg);
          return { ok: false, detail: msg };
        }

        // پرداخت با کیف پول داخلی — بدون تراکنش
        if (j.wallet_paid) {
          setSuccess(j.detail || 'پرداخت با موفقیت انجام شد ✓');
          return { ok: true, orderId: j.orderId, walletPaid: true, balanceTon: j.balanceTon };
        }

        if (feeNote) setSuccess(feeNote);
        const tx = j.tx as SendTx;
        const orderId = j.orderId as string | undefined;

        // ارسال با کیف پول کاربر (TON Connect)
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
        setSuccess('پرداخت انجام شد ✓ — پس از تأیید شبکه تکمیل می‌شود');
        return { ok: true, orderId };
      } catch (e) {
        const msg = friendly((e as Error)?.message || 'پرداخت لغو شد');
        setError(msg);
        return { ok: false, detail: msg };
      } finally {
        setBusy(false);
      }
    },
    [tonConnectUI],
  );

  /** ارسال یک تراکنش آماده (مثل انتقال NFT برای تحویل اجاره) */
  const sendTx = useCallback(
    async (tx: SendTx): Promise<{ ok: boolean; detail?: string }> => {
      setBusy(true);
      setError('');
      try {
        await tonConnectUI.sendTransaction({
          validUntil: tx.validUntil,
          messages: tx.messages.map((m) => ({
            address: m.address,
            amount: m.amount,
            ...(m.payload ? { payload: m.payload } : {}),
            ...(m.stateInit ? { stateInit: m.stateInit } : {}),
          })),
        });
        setSuccess('تراکنش ارسال شد ✓');
        return { ok: true };
      } catch (e) {
        const msg = friendly((e as Error)?.message || 'تراکنش لغو شد');
        setError(msg);
        return { ok: false, detail: msg };
      } finally {
        setBusy(false);
      }
    },
    [tonConnectUI],
  );

  return { purchase, sendTx, busy, error, success, setError, setSuccess };
}
