/**
 * عکس گیفت — نسخهٔ کلاینت‌پسند (بدون دیتابیس).
 * الگوی واقعی فرگمنت: nft.fragment.com/gift/{slug}-{num}.webp
 */

/** نگاشت دقیق نام کالکشن → slug فرگمنت (با nft.fragment.com تست شده) */
export const GIFT_SLUGS: Record<string, string> = {
  plushpepes: 'plushpepe',
  'plush pepe': 'plushpepe',
  plushpepe: 'plushpepe',
  scaredcats: 'scaredcat',
  scaredcat: 'scaredcat',
  resistancedogs: 'resistancedog',
  resistancedog: 'resistancedog',
  swisswatches: 'swisswatch',
  swisswatch: 'swisswatch',
  durovcaps: 'durovcap',
  durovs_cap: 'durovcap',
  'durov s cap': 'durovcap',
  lootbags: 'lootbag',
  lootbag: 'lootbag',
  heartlockets: 'heartlocket',
  heartlocket: 'heartlocket',
  libertyfigures: 'libertyfigure',
  libertyfigure: 'libertyfigure',
  snoopdoggs: 'snoopdogg',
  snoopdogg: 'snoopdogg',
  westsidesigns: 'westsidesign',
  westsidesign: 'westsidesign',
  chillflames: 'chillflame',
  chillflame: 'chillflame',
  vintagecigars: 'vintagecigar',
  vintagecigar: 'vintagecigar',
  toybears: 'toybear',
  toybear: 'toybear',
  voodoodolls: 'voodoodoll',
  voodoodoll: 'voodoodoll',
  kissedfrogs: 'kissedfrog',
  kissedfrog: 'kissedfrog',
  timelessbooks: 'timelessbook',
  timelessbook: 'timelessbook',
  lowriders: 'lowrider',
  lowrider: 'lowrider',
  vicecreams: 'vicecream',
  vicecream: 'vicecream',
  snoopcigars: 'snoopcigar',
  snoopcigar: 'snoopcigar',
  gemsignets: 'gemsignet',
  gemsignet: 'gemsignet',
  preciouspeaches: 'preciouspeach',
  preciouspeach: 'preciouspeach',
  astralshards: 'astralshard',
  astralshard: 'astralshard',
  inputkeys: 'inputkey',
  inputkey: 'inputkey',
  bondedrings: 'bondedring',
  bondedring: 'bondedring',
  nailbracelets: 'nailbracelet',
  nailbracelet: 'nailbracelet',
  icecreams: 'icecream',
  icecream: 'icecream',
  springbaskets: 'springbasket',
  springbasket: 'springbasket',
  lolpops: 'lolpop',
  lolpop: 'lolpop',
  signetrings: 'signetring',
  signetring: 'signetring',
  gingercookies: 'gingercookie',
  gingercookie: 'gingercookie',
  evileyes: 'evileye',
  evileye: 'evileye',
  ufcstrikes: 'ufcstrike',
  ufcstrike: 'ufcstrike',
  diamondrings: 'diamondring',
  diamondring: 'diamondring',
  heroicchelmets: 'heroichelmet',
  heroichelmets: 'heroichelmet',
  heroichelmet: 'heroichelmet',
  xmasstockings: 'xmasstocking',
  xmasstocking: 'xmasstocking',
  finepens: 'finepen',
  finepen: 'finepen',
  minioscars: 'minioscar',
  minioscar: 'minioscar',
  skullflowers: 'skullflower',
  skullflower: 'skullflower',
  tophats: 'tophat',
  tophat: 'tophat',
  freshsocks: 'freshsocks',
  freshsock: 'freshsocks',
  lotterytickets: 'lotteryticket',
  birthdaycandles: 'birthdaycandle',
  durovscap: 'durovcap',
};

/** «Plush Pepes» / «Durov's Cap» → کلید نگاشت */
export function collectionKeyOf(collectionName: string): string {
  const base = collectionName
    .replace(/#\d+.*$/, '')
    .replace(/[’'`.,]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ');
  const joined = base.replace(/ /g, '');
  if (GIFT_SLUGS[joined]) return joined;
  if (GIFT_SLUGS[base]) return base;
  return joined;
}

/** قاعدهٔ جمع→مفرد برای کالکشن‌های ناشناخته */
export function guessGiftSlugFromName(collectionName: string): string | null {
  const key = collectionKeyOf(collectionName);
  if (!key) return null;
  if (GIFT_SLUGS[key]) return GIFT_SLUGS[key];
  const s = key;
  if (s.endsWith('ies')) return s.slice(0, -3) + 'y';
  if (s.endsWith('sses')) return s.slice(0, -2);
  if (s.endsWith('shes') || s.endsWith('ches') || s.endsWith('xes')) return s.slice(0, -2);
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
}

export function giftImageUrlFromSlug(slug: string, num: number): string {
  return `https://nft.fragment.com/gift/${slug}-${num}.webp`;
}

/** از نام کامل آیتم («Fresh Socks #36377») مستقیم به URL عکس — بدون هیچ درخواست شبکه */
export function giftImageFromItemName(fullName: string): string | null {
  const m = fullName.match(/^(.*?)\s*#(\d+)\s*$/);
  if (!m) return null;
  const slug = guessGiftSlugFromName(m[1]);
  if (!slug) return null;
  return giftImageUrlFromSlug(slug, Number(m[2]));
}

/** لینک t.me از نام کامل آیتم (برای «مشاهده در تلگرام») */
export function telegramLinkFromItemName(fullName: string): string | null {
  const m = fullName.match(/^(.*?)\s*#(\d+)\s*$/);
  if (!m) return null;
  const slug = guessGiftSlugFromName(m[1]);
  return slug ? `https://t.me/nft/${slug}` : null;
}
