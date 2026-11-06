/**
 * کلاینت tonapi.io — دادهٔ واقعی زنجیرهٔ TON (رایگان و بدون توکن).
 * با کش چندلایه (حافظه + دیتابیس) تا محدودیت نرخ هرگز کاربر را نگیرد.
 */
import { TONAPI_BASE } from './env';
import { memGet, memSet, kvGet, kvSet } from './kv';

export type TonNftItem = {
  address: string;
  metadata?: {
    name?: string;
    image?: string;
    attributes?: { trait_type: string; value: string }[];
  };
  collection?: { address?: string; name?: string };
  owner?: { address?: string };
  sale?: {
    address?: string;
    marketplace?: { address?: string };
    price?: { value?: string | number; token_name?: string } | string | number;
  };
};

async function getJson<T>(url: string, timeoutMs = 12000): Promise<{ ok: boolean; status: number; data: T | null }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json', 'User-Agent': 'GiftifyBot/1.0 (+ton market)' },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data: data as T };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(t);
  }
}

/** آیتم NFT با کش ۲ دقیقه‌ای حافظه + ۱ ساعت دیتابیس */
export async function getNft(address: string): Promise<TonNftItem | null> {
  const key = `tonapi:nft:${address}`;
  const m = memGet<TonNftItem>(key, 2 * 60 * 1000);
  if (m) return m;
  const k = await kvGet<TonNftItem>(key, 60 * 60 * 1000);
  if (k) {
    memSet(key, k);
    return k;
  }
  const r = await getJson<TonNftItem>(`${TONAPI_BASE}/v2/nfts/${encodeURIComponent(address)}`);
  if (r.ok && r.data) {
    memSet(key, r.data);
    void kvSet(key, r.data);
    return r.data;
  }
  return null;
}

export type AccountTx = {
  hash: string;
  utime: number;
  in_msg?: {
    source?: { address?: string } | string;
    value?: string | number;
    message?: string;
    msg_data?: { message?: string; decoded_text?: string; text?: string };
  };
};

/** تراکنش‌های یک حساب (برای تشخیص واریز) — بدون کش طولانی (حافظه ۲۰ ثانیه) */
export async function getAccountTransactions(address: string, limit = 20): Promise<AccountTx[] | null> {
  const key = `tonapi:txs:${address}:${limit}`;
  const m = memGet<AccountTx[]>(key, 20 * 1000);
  if (m) return m;
  const r = await getJson<{ transactions?: AccountTx[] }>(
    `${TONAPI_BASE}/v2/accounts/${encodeURIComponent(address)}/transactions?limit=${limit}`,
    15000,
  );
  if (r.ok && r.data?.transactions) {
    memSet(key, r.data.transactions);
    return r.data.transactions;
  }
  return null;
}

/** متن کامنت یک پیام ورودی را در می‌آورد (همهٔ حالت‌های schema) */
export function txInComment(tx: AccountTx): string {
  const im = tx.in_msg;
  if (!im) return '';
  return String(im.message || im.msg_data?.decoded_text || im.msg_data?.message || im.msg_data?.text || '');
}

export function txInValueNano(tx: AccountTx): string {
  const v = tx.in_msg?.value;
  if (v === undefined || v === null) return '0';
  return typeof v === 'object' ? String((v as { value?: string }).value || 0) : String(v);
}

export function txInSender(tx: AccountTx): string {
  const s = tx.in_msg?.source;
  if (!s) return '';
  return typeof s === 'string' ? s : s.address || '';
}

/** قیمت فروش روی زنجیره — از آیتم یا قرارداد فروش */
export function salePriceNano(item: TonNftItem): string | null {
  if (!item.sale) return null;
  const p = item.sale.price;
  if (p === undefined || p === null) return null;
  if (typeof p === 'object') return String(p.value || 0);
  return String(p);
}

/** آدرس قرارداد فروش — پول باید به این آدرس برود */
export function saleContractAddress(item: TonNftItem): string | null {
  return item.sale?.address || null;
}
