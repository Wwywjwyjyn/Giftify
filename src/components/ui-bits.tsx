/** لوزی TON برای نمایش قیمت (مثل فرگمنت) — سایز پیش‌فرض همیشه حفظ می‌شود */
export function TonDiamond({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block h-3.5 w-3.5 align-[-2px] shrink-0 ${className}`} fill="currentColor" aria-label="TON">
      <path d="M12 2 22 9.5 12 22 2 9.5Z" />
    </svg>
  );
}

const PILL_STYLES: Record<string, string> = {
  buy: 'bg-accent/15 text-accent-hi',
  auction: 'bg-[#8B5CF6]/15 text-[#B79DFB]',
  rent: 'bg-ok/15 text-ok',
  sold: 'bg-bad/15 text-bad',
  resale: 'bg-muted/15 text-muted',
  local: 'bg-[#F59E0B]/15 text-[#FBBF24]',
};

const PILL_LABELS: Record<string, string> = {
  buy: 'خرید',
  auction: 'حراج',
  rent: 'اجاره',
  sold: 'تکمیل شد',
  resale: 'غیرقابل خرید',
  local: 'لیستینگ سایت',
};

export function StatusPill({ kind, label }: { kind: keyof typeof PILL_STYLES | string; label?: string }) {
  const cls = PILL_STYLES[kind] || PILL_STYLES.resale;
  return <span className={`pill ${cls}`}>{label || PILL_LABELS[kind] || kind}</span>;
}
