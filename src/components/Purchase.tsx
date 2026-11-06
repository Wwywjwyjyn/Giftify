'use client';

import { useEffect, useRef, useState } from 'react';

export type PayCurrency = 'GRAM' | 'TON' | 'USDT';

/** انتخاب روش پرداخت (واحد نمایشی مارکت‌اپ) */
export function PaymentMethod({ value, onChange }: { value: PayCurrency; onChange: (c: PayCurrency) => void }) {
  const opts: { key: PayCurrency; label: string }[] = [
    { key: 'GRAM', label: 'GRAM' },
    { key: 'TON', label: 'TON' },
    { key: 'USDT', label: 'USDT' },
  ];
  return (
    <div className="flex gap-2">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors ${
            value === o.key ? 'border-accent bg-accent/15 text-accent-hi' : 'border-line bg-panel2 text-muted hover:border-[#2F4156]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * جستجوی گیرنده (یوزرنیم) با نمایش نام و عکس واقعی — از t.me بدون نیاز به هیچ توکنی.
 * endpoint باید /api/tg/resolve باشد.
 */
export function RecipientSearch({ endpoint, label, onFound }: { endpoint: string; label: string; onFound?: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [info, setInfo] = useState<{ photo?: string; name?: string } | null>(null);
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);
  const foundRef = useRef(onFound);
  foundRef.current = onFound;

  useEffect(() => {
    const u = username.replace(/^@/, '').trim();
    if (u.length < 3) {
      setInfo(null);
      setErr('');
      return;
    }
    setChecking(true);
    const t = setTimeout(() => {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.ok && (j.photo || j.name)) {
            setInfo({ photo: j.photo, name: j.name });
            setErr('');
            foundRef.current?.(u);
          } else if (j.photo || j.name) {
            // سازگاری با پاسخ قدیمی
            setInfo({ photo: j.photo, name: j.name });
            foundRef.current?.(u);
          } else {
            setInfo(null);
            setErr(j.detail || 'این یوزرنیم پیدا نشد — درست نوشته شده؟');
          }
        })
        .catch(() => setErr('خطا در جستجو — دوباره تلاش کنید'))
        .finally(() => setChecking(false));
    }, 500);
    return () => clearTimeout(t);
  }, [username, endpoint]);

  return (
    <div>
      <label className="mb-2 block text-sm font-bold">{label}</label>
      <div className="relative">
        <input
          className="input pe-4"
          placeholder="یوزرنیم تلگرام را وارد کنید…"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          dir="ltr"
          autoComplete="off"
        />
        {checking && <span className="spin absolute end-4 top-1/2 -translate-y-1/2" />}
      </div>
      {info && (
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2">
          {info.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.photo} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-panel2 text-sm font-bold">{(info.name || '?').slice(0, 1)}</div>
          )}
          <div className="text-sm font-bold text-ok">{info.name}</div>
          <div className="text-xs text-muted" dir="ltr">@{username.replace(/^@/, '')}</div>
        </div>
      )}
      {err && <div className="mt-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">{err}</div>}
    </div>
  );
}
