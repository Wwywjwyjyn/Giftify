import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/** مانیفست داینامیک TON Connect روی همان دامنه‌ای که سایت اجرا شده */
export async function GET(req: Request) {
  const envUrl = env.baseUrl;
  let base = envUrl;
  if (!base) {
    const h = req.headers;
    const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
    const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
    base = `${proto}://${host}`;
  }
  base = base.replace(/\/$/, '');
  return NextResponse.json({
    url: base,
    name: env.siteName,
    iconUrl: `${base}/icon.svg`,
    termsOfUseUrl: `${base}/`,
  });
}
