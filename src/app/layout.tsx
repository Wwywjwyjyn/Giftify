import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { TonProvider } from '@/components/TonProvider';
import { CartProvider } from '@/components/CartProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BgBalls } from '@/components/BgBalls';

export const metadata: Metadata = {
  title: { default: 'Giftify — اجاره و خرید گیفت، یوزرنیم و شماره تلگرام', template: '%s | Giftify' },
  description: 'اجاره گیفت‌ها، یوزرنیم‌ها و شماره‌های کلکسیونی تلگرام + انباری و سبد خرید — بر پایه TON و API مارکت‌اپ',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#05080C',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-bg text-ink antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <BgBalls />
        <TonProvider>
          <CartProvider>
            <div className="relative z-10 flex min-h-screen flex-col">
              <Header />
              <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-16 pt-4 sm:px-5">{children}</main>
              <Footer />
            </div>
          </CartProvider>
        </TonProvider>
      </body>
    </html>
  );
}
