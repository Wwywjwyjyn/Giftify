import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { TonProvider } from '@/components/TonProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: { default: 'Giftify — بازار گیفت، یوزرنیم و شماره تلگرام', template: '%s | Giftify' },
  description: 'خرید و فروش گیفت‌ها، یوزرنیم‌ها و شماره‌های کلکسیونی تلگرام + اجاره — بر پایه TON و API مارکت‌اپ',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#0E1620',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-bg text-ink antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <TonProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-16 pt-4 sm:px-5">{children}</main>
            <Footer />
          </div>
        </TonProvider>
      </body>
    </html>
  );
}
