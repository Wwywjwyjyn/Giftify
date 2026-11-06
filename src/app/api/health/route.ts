import { env } from '@/lib/env';
import { maFetch } from '@/lib/marketapp';
import { APP_VERSION } from '@/lib/version';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tokenSet = !!env.marketappToken;
  let tokenValid = false;
  let saleFeed = false;
  if (tokenSet) {
    // یک endpoint رایگان برای بررسی سلامت توکن
    const probe = await maFetch('/v1/rent/gifts/', { query: { limit: 1 } }, 12000);
    tokenValid = probe.status === 200;
    if (tokenValid) {
      const sale = await maFetch('/v1/gifts/onsale/', { query: { limit: 1 } }, 12000);
      saleFeed = sale.status === 200;
    }
  }
  return Response.json({
    ok: true,
    version: APP_VERSION,
    token_set: tokenSet,
    token_valid: tokenValid,
    sale_feed: saleFeed,
    telegram: !!env.telegramBotToken,
    time: Date.now(),
  });
}
