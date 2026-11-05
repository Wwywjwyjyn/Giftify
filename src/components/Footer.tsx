import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-[#04070A] safe-bottom">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-5 text-xs text-muted">
        <Link href="/rent" className="hover:text-ink">اجاره‌های برتر</Link>
        <Link href="/inventory" className="hover:text-ink">انباری من</Link>
        <Link href="/cart" className="hover:text-ink">سبد خرید</Link>
        <span>قوانین</span>
        <span>حریم خصوصی</span>
        <span className="flex items-center gap-1">
          ساخته‌شده روی
          <svg viewBox="0 0 24 24" className="h-3 w-3 text-ton" fill="currentColor"><path d="M12 2 22 9.5 12 22 2 9.5Z" /></svg>
          TON
        </span>
      </div>
    </footer>
  );
}
