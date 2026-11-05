/**
 * تأیید ton_proof طبق مستند رسمی TON Connect (ton-proof-item-v2).
 * آدرس باید با StateInit کیف پول بخواند و کلید عمومی باید واقعاً داخل داده‌ی StateInit باشد؛
 * پس کسی نمی‌تواند با کلید خودش برای آدرس دیگران امضا کند.
 */
import { createHash } from 'crypto';
import { Address, Cell, loadStateInit } from '@ton/core';
import { signVerify } from '@ton/crypto';

export type TonLogin = {
  address: string; // raw (0:abc…) یا friendly
  publicKey: string; // hex — از account.publicKey
  walletStateInit: string; // base64 — از account.walletStateInit
  proof: {
    timestamp: number;
    domain: { lengthBytes?: number; value: string };
    signature: string; // base64
    payload?: string;
  };
};

function bitString(cell: Cell): string {
  let s = '';
  const bits = cell.bits;
  for (let i = 0; i < bits.length; i++) s += bits.at(i) ? '1' : '0';
  return s;
}

function hexToBits(hex: string): string {
  let s = '';
  for (const ch of hex.toLowerCase()) s += parseInt(ch, 16).toString(2).padStart(4, '0');
  return s;
}

const stripPort = (h: string) => h.toLowerCase().split(':')[0];

export function verifyTonLogin(p: TonLogin, allowedHosts: string[]): { ok: boolean; reason?: string } {
  try {
    if (!p?.proof?.signature || !p.address || !p.publicKey || !p.walletStateInit) {
      return { ok: false, reason: 'اطلاعات proof ناقص است' };
    }
    if (!/^[0-9a-fA-F]{64}$/.test(p.publicKey)) return { ok: false, reason: 'کلید عمومی نامعتبر' };

    // زمان (۱۰ دقیقه)
    const ts = Math.floor(Number(p.proof.timestamp));
    if (!ts || Math.abs(Date.now() / 1000 - ts) > 10 * 60) return { ok: false, reason: 'proof منقضی شده' };

    // دامنه باید همین سایت باشد
    const domain = String(p.proof.domain?.value || '');
    const okHost = allowedHosts.filter(Boolean).some((h) => stripPort(h) === stripPort(domain));
    if (!okHost) return { ok: false, reason: 'دامنهٔ proof با سایت نمی‌خواند' };

    // آدرس ↔ StateInit
    const addr = Address.parse(p.address);
    const si = Cell.fromBase64(p.walletStateInit);
    if (!Buffer.from(si.hash()).equals(Buffer.from(addr.hash))) {
      return { ok: false, reason: 'StateInit با آدرس نمی‌خواند' };
    }

    // کلید عمومی ↔ StateInit (باید داخل داده‌ی کیف پول باشد)
    const st = loadStateInit(si.beginParse());
    if (!st.data) return { ok: false, reason: 'StateInit بدون داده' };
    if (!bitString(st.data).includes(hexToBits(p.publicKey))) {
      return { ok: false, reason: 'کلید عمومی با کیف پول نمی‌خواند' };
    }

    // ساخت پیام طبق مستند
    const wc = Buffer.alloc(4);
    wc.writeInt32BE(addr.workChain);
    const domBuf = Buffer.from(domain, 'utf8');
    const domLen = Buffer.alloc(4);
    domLen.writeUInt32LE(domBuf.length);
    const tsBuf = Buffer.alloc(8);
    tsBuf.writeBigUInt64LE(BigInt(ts));
    const msg = Buffer.concat([
      Buffer.from('ton-proof-item-v2/', 'utf8'),
      wc,
      Buffer.from(addr.hash),
      domLen,
      domBuf,
      tsBuf,
      Buffer.from(String(p.proof.payload ?? ''), 'utf8'),
    ]);
    const msgHash = createHash('sha256').update(msg).digest();
    const toSign = createHash('sha256')
      .update(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect', 'utf8'), msgHash]))
      .digest();

    const ok = signVerify(toSign, Buffer.from(p.proof.signature, 'base64'), Buffer.from(p.publicKey, 'hex'));
    return ok ? { ok: true } : { ok: false, reason: 'امضا معتبر نیست' };
  } catch (e) {
    return { ok: false, reason: `خطای تأیید: ${(e as Error).message}` };
  }
}
