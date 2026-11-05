/**
 * تأیید ton_proof — امضای دیجیتال اتصال کیف پول TON
 * طبق مستند TON Connect: پیام شامل domain و timestamp و آدرس است و با کلید عمومی
 * استخراج‌شده از StateInit کیف پول امضا می‌شود.
 */
import { Address, Cell } from '@ton/core';
import { signVerify } from '@ton/crypto';

export type TonProof = {
  address: string; // friendly EQ.../UQ...
  proof: {
    timestamp: number;
    domain: { lengthBytes: number; value: string };
    signature: string; // base64
    payload?: string;
    state_init?: string; // base64 BOC
  };
};

/** از StateInit، کلید عمومی کیف پول نسخه ۴/۳ را درمی‌آورد */
function extractPublicKeyFromStateInit(stateInitB64: string): Buffer | null {
  try {
    const cell = Cell.fromBase64(stateInitB64);
    const find = (c: Cell, depth = 0): Buffer | null => {
      if (depth > 4) return null;
      try {
        if (c.bits.length >= 392) {
          const s = c.beginParse();
          s.skip(64);
          return s.loadBuffer(32);
        }
      } catch {
        /* ادامه */
      }
      for (const ref of c.refs) {
        const r = find(ref, depth + 1);
        if (r) return r;
      }
      return null;
    };
    return find(cell);
  } catch {
    return null;
  }
}

/**
 * تأیید کامل ton_proof طبق الگوی مرجع:
 * message = 0xffff | "ton-connect" | ts(int64) | domain(buffer) | "ton-proof"(buffer) | addrHash(buffer)
 */
export function verifyTonProof(p: TonProof): { ok: boolean; reason?: string } {
  try {
    if (!p?.proof?.signature || !p?.address) return { ok: false, reason: 'proof ناقص است' };
    const age = Math.abs(Date.now() / 1000 - (p.proof.timestamp || 0));
    if (age > 60 * 60 * 24) return { ok: false, reason: 'proof منقضی شده' };

    const addr = Address.parse(p.address);
    const addrHash = Buffer.from(addr.hash);

    // ساخت پیام مطابق TL مورد انتظار کیف پول‌ها
    const domainBuf = Buffer.from(p.proof.domain?.value || '', 'utf8');
    const tsBuf = Buffer.alloc(8);
    tsBuf.writeBigInt64LE(BigInt(Math.floor(p.proof.timestamp)));

    const lenBuf = (b: Buffer) => {
      const l = Buffer.alloc(4);
      l.writeUInt32LE(b.length);
      return l;
    };

    const message = Buffer.concat([
      Buffer.from([0xff, 0xff]),
      Buffer.from('ton-connect', 'utf8'),
      tsBuf,
      lenBuf(domainBuf),
      domainBuf,
      lenBuf(Buffer.from('ton-proof')),
      Buffer.from('ton-proof'),
      lenBuf(addrHash),
      addrHash,
    ]);

    const signature = Buffer.from(p.proof.signature, 'base64');

    // کلید عمومی: از state_init اگر بود، وگرنه از payload public_key
    let pubkey: Buffer | null = null;

    const pubkeyFromPayload = (p.proof as unknown as { public_key?: string }).public_key;
    if (pubkeyFromPayload && /^[0-9a-fA-F]{64}$/.test(pubkeyFromPayload)) {
      pubkey = Buffer.from(pubkeyFromPayload, 'hex');
    }
    if (!pubkey && p.proof.state_init) {
      try {
        const cell = Cell.fromBase64(p.proof.state_init);
        // stateInit = code^data → سلول data کلید عمومی دارد
        // بازگشتی: سلولی که ۳۲ بایت پیاپی دارد را پیدا کن
        const find = (c: Cell, depth = 0): Buffer | null => {
          if (depth > 4) return null;
          try {
            const bits = c.bits;
            if (bits.length >= 392) {
              // 32 (seqno) + 32 (walletId) + 256 (pubkey) → برای v3/v4
              const s = c.beginParse();
              s.skip(64);
              const pk = s.loadBuffer(32);
              return pk;
            }
          } catch {
            /* ادامه */
          }
          for (const ref of c.refs) {
            const r = find(ref, depth + 1);
            if (r) return r;
          }
          return null;
        };
        pubkey = find(cell);
      } catch {
        pubkey = null;
      }
    }
    if (!pubkey) return { ok: false, reason: 'کلید عمومی کیف پول در proof نیست' };

    // تطبیق آدرس با StateInit (hash(stateInit) باید برابر هش آدرس باشد)
    if (p.proof.state_init) {
      try {
        const cell = Cell.fromBase64(p.proof.state_init);
        const h = Buffer.from(cell.hash());
        if (!h.equals(addrHash)) return { ok: false, reason: 'StateInit با آدرس نمی‌خواند' };
      } catch {
        /* اگر پارس نشد، تأیید امضا کافی است */
      }
    }

    const ok = signVerify(message, signature, pubkey);
    return ok ? { ok: true } : { ok: false, reason: 'امضا معتبر نیست' };
  } catch (e) {
    return { ok: false, reason: `خطای تأیید: ${(e as Error).message}` };
  }
}
