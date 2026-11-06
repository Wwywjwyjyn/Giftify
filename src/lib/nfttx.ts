/**
 * ساخت تراکنش‌های واقعی TON با @ton/core:
 *  ۱) انتقال NFT (TEP-62) — برای تحویل اجاره / بازگشت اجاره / تحویل خرید
 *  ۲) خرید NFT فرگمنت — ارسال TON به قرارداد فروش (قیمت + بافر شبکه)
 */
import { beginCell, Address } from '@ton/core';

export type TxBuilt = { validUntil: number; messages: { address: string; amount: string; payload?: string }[] };

/** بدنهٔ انتقال NFT استاندارد TEP-62 → BOC base64 */
export function nftTransferPayload(opts: {
  nftAddress: string; // قرارداد آیتم
  toAddress: string; // گیرندهٔ جدید
  fromAddress: string; // مالک فعلی (برای پاسخ‌گویی)
  forwardTonNano?: string | number;
  comment?: string;
}): string {
  const dest = Address.parse(opts.nftAddress);
  const resp = Address.parse(opts.fromAddress);
  const fwd = BigInt(opts.forwardTonNano || 10000000); // 0.01 TON پیش‌فرض
  const commentCell = beginCell()
    .storeUint(0, 32) // op صفر = کامنت متنی
    .storeStringTail(opts.comment || 'Giftify');
  const body = beginCell()
    .storeUint(0x5fcc3d14, 32) // op::transfer
    .storeUint(Date.now() % 1e15, 64) // query_id
    .storeCoins(0)
    .storeAddress(dest) // destination = قرارداد NFT
    .storeAddress(resp) // response_destination = مالک
    .storeUint(0, 1) // custom_payload: none
    .storeCoins(fwd)
    .storeUint(1, 1) // forward_payload: ref
    .storeRef(commentCell.endCell())
    .endCell();
  return body.toBoc().toString('base64');
}

/**
 * تراکنش خرید واقعی NFT روی فرگمنت:
 * مقدار = قیمت فروش + بافر کارمزد شبکه؛ به قرارداد فروش (یا خود آیتم) فرستاده می‌شود.
 * قرارداد مازاد را برمی‌گرداند. کارمزد سایت به‌صورت پیام دوم واقعاً واریز می‌شود.
 */
export function buildBuyTx(opts: {
  saleAddress: string; // قرارداد فروش (tonapi: sale.address یا خود NFT)
  priceNano: string;
  feeWallet?: string | null;
  feeNano?: string;
}): TxBuilt {
  const price = BigInt(opts.priceNano);
  const buffer = 50000000n; // 0.05 TON بافر شبکه (بازگشت خودکار)
  const messages: TxBuilt['messages'] = [
    { address: opts.saleAddress, amount: (price + buffer).toString() },
  ];
  if (opts.feeWallet && opts.feeNano && BigInt(opts.feeNano) > 0n) {
    messages.push({ address: opts.feeWallet, amount: opts.feeNano });
  }
  return { validUntil: Math.floor(Date.now() / 1000) + 600, messages };
}

/** انتقال NFT برای تحویل/بازگشت (مالک با TON Connect خودش امضا می‌کند) */
export function buildNftTransferTx(opts: {
  nftAddress: string;
  fromAddress: string;
  toAddress: string;
  comment?: string;
}): TxBuilt {
  const payload = nftTransferPayload({
    nftAddress: opts.nftAddress,
    toAddress: opts.toAddress,
    fromAddress: opts.fromAddress,
    comment: opts.comment,
  });
  return {
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [{ address: opts.nftAddress, amount: '50000000', payload }], // 0.05 TON برای اجاره/کارمزد انتقال
  };
}

export const isTonAddress = (s: string) => /^(EQ|UQ|0:[A-Za-z0-9]{64})/.test(s.trim());

/** همهٔ شکل‌های آدرس TON (EQ/UQ/0:hex) به یک فرم مقایسه‌پذیر: «0:hex» با حروف کوچک */
export function toRawAddress(addr?: string | null): string {
  if (!addr) return '';
  const s = String(addr).trim();
  if (/^-?0:[0-9a-fA-F]{64}$/.test(s)) return '0:' + s.split(':')[1].toLowerCase();
  if (/^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(s)) {
    try {
      if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(s.slice(2), 'base64url');
        if (buf.length === 36) return '0:' + buf.slice(2, 34).toString('hex').toLowerCase();
      }
    } catch {
      /* ادامه */
    }
  }
  return s.toLowerCase();
}
