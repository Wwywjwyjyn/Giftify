/**
 * استخراج اطلاعات صفحهٔ t.me — عنوان، توضیح، عکس، اعضا.
 * مشترک بین سرچ (کانال/آیدی) و resolve گیرندهٔ استارز/پرمیوم.
 */

export type ChannelInfo = {
  name: string;
  exists: boolean;
  title: string;
  description: string;
  image: string;
  members: string;
  link: string;
};

export async function fetchTelegramPage(name: string): Promise<ChannelInfo> {
  const out: ChannelInfo = { name, exists: false, title: '', description: '', image: '', members: '', link: `https://t.me/${name}` };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(`https://t.me/${name}`, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GiftifyBot/1.0)', 'Accept-Language': 'en' },
      cache: 'no-store',
    });
    clearTimeout(t);
    if (!res.ok) return out;
    const html = await res.text();
    const pick = (re: RegExp) => {
      const m = html.match(re);
      return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
    };
    const title = pick(/<meta property="og:title" content="([^"]*)"/i);
    out.description = pick(/<meta property="og:description" content="([^"]*)"/i);
    out.image = pick(/<meta property="og:image" content="([^"]*)"/i);
    out.members = pick(/class="tgme_page_extra">([^<]*)</i);
    if (title && !/^Telegram: Contact/i.test(title)) {
      out.exists = true;
      out.title = title;
    }
    return out;
  } catch {
    return out;
  }
}
