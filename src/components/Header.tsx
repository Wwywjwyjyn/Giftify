'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Shield } from 'lucide-react';
import { WalletBox } from './WalletBox';

const NAV = [
  { href: '/', label: 'یوزرنیم‌ها' },
  { href: '/numbers', label: 'شماره‌ها' },
  { href: '/gifts', label: 'گیفت‌ها' },
  { href: '/rent', label: 'اجاره' },
  { href: '/stars', label: 'استارز' },
  { href: '/premium', label: 'پرمیوم' },
  { href: '/ads', label: 'تبلیغات' },
];

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[#0B121A]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-3 sm:px-5">
        {/* لوگوی نستعلیق مثل فرگمنت */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <svg viewBox="0 0 64 64" className="h-6 w-6 shrink-0">
            <path d="M32 6 L56 22 L32 58 L8 22 Z" fill="#1691C4" />
            <path d="M32 6 L56 22 L32 32 L8 22 Z" fill="#1BA6DC" />
          </svg>
          <span className="logo-nasta text-2xl text-ink">گیفتیفای</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-5 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`tab ${isActive(n.href) ? 'active' : ''}`}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2 md:ms-0">
          <WalletBox />
          <button
            className="rounded-md p-2 text-muted hover:text-ink md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="منو"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-panel px-3 pb-3 pt-2 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm ${isActive(n.href) ? 'bg-panel2 text-ink' : 'text-muted'}`}
            >
              {n.label}
            </Link>
          ))}
          <Link href="/admin" className="block rounded-lg px-3 py-2.5 text-sm text-muted" onClick={() => setOpen(false)}>
            <Shield size={14} className="inline align-middle" /> پنل مدیریت
          </Link>
        </nav>
      )}
    </header>
  );
}
