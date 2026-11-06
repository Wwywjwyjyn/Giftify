'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Shield, Save, CheckCircle2, Wallet2, PackageCheck, RotateCcw, XCircle, RefreshCw, Upload, History, Bug, Sparkles, Wrench, Lock, FileJson } from 'lucide-react';
import { faNum, fmtTon } from '@/lib/format';
import { TonDiamond } from '@/components/ui-bits';

type Settings = {
  site_name: string;
  fee_wallet: string;
  deposit_wallet: string;
  fee_usernames: number;
  fee_numbers: number;
  fee_gifts: number;
  fee_rent: number;
  fee_stars: number;
  fee_premium: number;
  fee_giveaway: number;
  fee_ads: number;
  price_stars_per100: number;
  price_premium_3m: number;
  price_premium_6m: number;
  price_premium_12m: number;
  notice: string;
};
type Order = { id: string; kind: string; title: string; amountTon: number; feeTon: number; status: string; payMethod?: string | null; createdAt: string };
type FeeRow = { id: string; section: string; amountTon: number; wallet: string; status: string; createdAt: string };
type User = { id: number; role: string; wallet?: string; telegramId?: string; name?: string; balanceTon?: number; createdAt: string };
type Listing = { id: string; kind: string; name: string; priceTon?: number | null; rentPerDayTon?: number | null; status: string; ownerWallet: string; nftAddress?: string | null };
type Health = { token_set?: boolean; token_valid?: boolean; sale_feed?: boolean; telegram?: boolean };
type UpdateChange = { type: string; text: string };
type UpdateRow = { id: string; version: string; title: string; changes: UpdateChange[]; fileName?: string | null; appliedSettings: boolean; appliedAt: string };
type UpdatesInfo = { code_version: string; min_code_version: string; updates: UpdateRow[] };

const SECTIONS: { key: keyof Settings; label: string }[] = [
  { key: 'fee_usernames', label: 'یوزرنیم‌ها' },
  { key: 'fee_numbers', label: 'شماره‌ها' },
  { key: 'fee_gifts', label: 'گیفت‌ها' },
  { key: 'fee_rent', label: 'اجاره' },
  { key: 'fee_stars', label: 'استارز' },
  { key: 'fee_premium', label: 'پرمیوم' },
  { key: 'fee_giveaway', label: 'گیوِی' },
  { key: 'fee_ads', label: 'تبلیغات' },
];

const STATUS_FA: Record<string, string> = {
  PENDING_TX: 'در انتظار پرداخت', TX_SENT: 'پرداخت شد', AWAITING_DELIVERY: 'در صف تحویل',
  DELIVERED: 'تحویل شد', DONE: 'تکمیل شد', FAILED: 'ناموفق', REFUNDED: 'برگشت مبلغ',
  RENT_ACTIVE: 'اجاره فعال', RENT_OVERDUE: 'اجاره معوق', CANCELLED: 'لغو شد',
};

const CHANGE_META: Record<string, { label: string; cls: string; Icon: typeof Bug }> = {
  fix: { label: 'رفع باگ', cls: 'text-bad bg-bad/10 border-bad/30', Icon: Bug },
  feature: { label: 'قابلیت جدید', cls: 'text-ok bg-ok/10 border-ok/30', Icon: Sparkles },
  improvement: { label: 'بهبود', cls: 'text-accent-hi bg-accent/10 border-accent/30', Icon: Wrench },
  security: { label: 'امنیت', cls: 'text-[#FBBF24] bg-[#FBBF24]/10 border-[#FBBF24]/30', Icon: Lock },
  other: { label: 'تغییر', cls: 'text-muted bg-panel2 border-line', Icon: FileJson },
};

export function AdminInner() {
  const [tab, setTab] = useState<'fees' | 'orders' | 'users' | 'listings' | 'updates'>('fees');
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [health, setHealth] = useState<Health>({});
  const [denied, setDenied] = useState(false);
  const [nf, setNf] = useState({ name: '', kind: 'gift', price: '', rent: '', min: '1', max: '30', nft: '', owner: '' });
  const [updatesInfo, setUpdatesInfo] = useState<UpdatesInfo | null>(null);
  const [updateMsg, setUpdateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    const sr = await fetch('/api/admin/settings', { cache: 'no-store' });
    if (sr.status === 403) { setDenied(true); return; }
    setS(await sr.json());
    fetch('/api/admin/orders', { cache: 'no-store' }).then((r) => r.json()).then((j) => { setOrders(j.orders || []); setFees(j.fees || []); }).catch(() => {});
    fetch('/api/admin/users', { cache: 'no-store' }).then((r) => r.json()).then((j) => setUsers(j.users || [])).catch(() => {});
    fetch('/api/admin/listings', { cache: 'no-store' }).then((r) => r.json()).then((j) => setListings(j.listings || [])).catch(() => {});
    fetch('/api/health', { cache: 'no-store' }).then((r) => r.json()).then((j) => setHealth(j)).catch(() => {});
    fetch('/api/admin/updates', { cache: 'no-store' }).then((r) => r.json()).then((j) => setUpdatesInfo(j)).catch(() => {});
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function save() {
    if (!s) return;
    await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function markPaid(id: string) {
    await fetch('/api/admin/fees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'PAID' }) });
    setFees((f) => f.map((x) => (x.id === id ? { ...x, status: 'PAID' } : x)));
  }

  async function toggleRole(u: User) {
    await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' }) });
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, role: x.role === 'ADMIN' ? 'USER' : 'ADMIN' } : x)));
  }

  async function orderAction(id: string, action: 'deliver' | 'complete' | 'refund' | 'fail') {
    await fetch('/api/admin/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    loadAll();
  }

  async function creditUser(u: User) {
    const input = window.prompt(`شارژ دستی کیف پول کاربر ${u.wallet?.slice(0, 10)}… — مقدار TON:`);
    if (!input) return;
    const amount = Number(input.replace(/[^\d.]/g, ''));
    if (!(amount > 0)) return;
    await fetch('/api/admin/wallet-credit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id, amountTon: amount, note: 'شارژ دستی پشتیبانی' }) });
    loadAll();
  }

  async function addListing() {
    if (!nf.name.trim()) return;
    await fetch('/api/admin/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nf.name, kind: nf.kind,
        ownerWallet: nf.owner || undefined,
        nftAddress: nf.nft || null,
        priceTon: nf.price ? Number(nf.price) : null,
        rentPerDayTon: nf.rent ? Number(nf.rent) : null,
        rentMinDays: Number(nf.min) || 1, rentMaxDays: Number(nf.max) || 30,
      }),
    });
    setNf({ name: '', kind: nf.kind, price: '', rent: '', min: '1', max: '30', nft: '', owner: '' });
    loadAll();
  }

  async function delListing(id: string) {
    await fetch(`/api/admin/listings?id=${id}`, { method: 'DELETE' });
    setListings((l) => l.filter((x) => x.id !== id));
  }

  async function applyUpdateFile(f: File) {
    setApplying(true);
    setUpdateMsg(null);
    try {
      const text = await f.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        setUpdateMsg({ ok: false, text: 'فایل JSON معتبر نیست — فایل به‌روزرسانی را دست‌نخورده بارگذاری کنید' });
        return;
      }
      const r = await fetch('/api/admin/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: json, file_name: f.name }),
      });
      const j = await r.json();
      if (j.ok) {
        setUpdateMsg({ ok: true, text: `به‌روزرسانی ${j.version} اعمال شد ✓${j.appliedSettings ? ' — تنظیمات جدید فعال شد' : ''}` });
        fetch('/api/admin/updates', { cache: 'no-store' }).then((res) => res.json()).then((x) => setUpdatesInfo(x)).catch(() => {});
      } else {
        setUpdateMsg({ ok: false, text: j.detail || 'اعمال به‌روزرسانی ممکن نشد' });
      }
    } finally {
      setApplying(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (denied) {
    return (
      <div className="card mx-auto mt-12 max-w-md p-8 text-center text-sm leading-7">
        <Shield className="mx-auto mb-3 text-muted" size={28} />
        این بخش فقط برای مدیر سایت است. اگر شما اولین کاربر هستید، اول از دکمه «اتصال کیف پول» وارد شوید.
      </div>
    );
  }
  if (!s) return <div className="flex justify-center py-20"><span className="spin" /></div>;

  const awaiting = orders.filter((o) => ['AWAITING_DELIVERY', 'RENT_ACTIVE', 'RENT_OVERDUE'].includes(o.status));

  return (
    <div className="py-6">
      <h1 className="hero-title">پنل مدیریت گیفتیفای</h1>

      {/* وضعیت اتصال‌ها */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4 text-sm">
          <div className="text-muted">سرویس بازار جهانی (مارکت‌اپ)</div>
          <div className={`mt-1 font-bold ${health.token_valid ? 'text-ok' : 'text-muted'}`}>
            {!health.token_set ? 'تنظیم نشده' : health.token_valid ? 'فعال ✓' : 'موقتاً محدود'}
          </div>
          {health.token_set && !health.token_valid && (
            <div className="mt-1 text-[11px] leading-5 text-muted">با فعال‌سازی، فید جهانی اجاره/خرید هم به بازار اضافه می‌شود</div>
          )}
        </div>
        <div className="card p-4 text-sm">
          <div className="text-muted">فید خرید NFT (پلن API)</div>
          <div className={`mt-1 font-bold ${health.sale_feed ? 'text-ok' : 'text-muted'}`}>{health.sale_feed ? 'فعال ✓' : 'نیازمند پلن'}</div>
        </div>
        <div className="card p-4 text-sm">
          <div className="text-muted">ربات تلگرام (Mini App)</div>
          <div className={`mt-1 font-bold ${health.telegram ? 'text-ok' : 'text-muted'}`}>{health.telegram ? 'تنظیم شده ✓' : 'اختیاری'}</div>
        </div>
      </div>

      {/* تب‌ها */}
      <div className="mt-6 flex gap-6 overflow-x-auto border-b border-line">
        {([['fees', 'تنظیمات'], ['orders', 'سفارش‌ها'], ['users', 'کاربران'], ['listings', 'لیستینگ محلی'], ['updates', 'بروزرسانی']] as const).map(([k, l]) => (
          <button key={k} className={`tab whitespace-nowrap ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'fees' && (
        <div className="mt-6 max-w-2xl space-y-5">
          <div className="card p-5">
            <label className="mb-2 block text-sm font-bold">کیف پول دریافت کارمزد (آدرس TON)</label>
            <input className="input" dir="ltr" placeholder="EQ… / UQ…" value={s.fee_wallet} onChange={(e) => setS({ ...s, fee_wallet: e.target.value })} />
            <p className="mt-2 text-xs leading-6 text-muted">
              کارمزد هر بخش به این آدرس پرداخت و در «سفارش‌ها» شفاف ثبت می‌شود.
            </p>
          </div>

          <div className="card p-5">
            <label className="mb-2 block flex items-center gap-1.5 text-sm font-bold">
              <Wallet2 size={15} className="text-ok" /> کیف واریز گرام کاربران (آدرس TON)
            </label>
            <input className="input" dir="ltr" placeholder="EQ… / UQ… — جدا از کیف کارمزد و کیف شخصی شما" value={s.deposit_wallet} onChange={(e) => setS({ ...s, deposit_wallet: e.target.value })} />
            <p className="mt-2 text-xs leading-6 text-muted">
              کاربران برای شارژ «کیف پول سایت» به این آدرس با کد یادمان خودشان واریز می‌کنند؛ پول خریدها همین‌جا جمع می‌شود و فقط کیف کارمزد جداگانه کارمزد را می‌گیرد.
            </p>
          </div>

          <div className="card p-5">
            <div className="mb-3 text-sm font-bold">درصد کارمزد هر بخش</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SECTIONS.map((sec) => (
                <div key={sec.key}>
                  <label className="mb-1 block text-xs text-muted">{sec.label} (٪)</label>
                  <input
                    className="input py-2"
                    inputMode="decimal"
                    value={String(s[sec.key] ?? 0)}
                    onChange={(e) => setS({ ...s, [sec.key]: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 } as Settings)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-1 text-sm font-bold">قیمت‌های استارز و پرمیوم (TON)</div>
            <div className="mb-3 text-xs leading-5 text-muted">
              اگر سرویس بازار جهانی فعال باشد قیمت لحظه‌ای نمایش داده می‌شود؛ در غیر این صورت این تعرفه‌ها مبناست — هر وقت خواستید به‌روز کنید.
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-muted">هر ۱۰۰ استارز</label>
                <input className="input py-2" inputMode="decimal" value={String(s.price_stars_per100)} onChange={(e) => setS({ ...s, price_stars_per100: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">پرمیوم ۳ ماه</label>
                <input className="input py-2" inputMode="decimal" value={String(s.price_premium_3m)} onChange={(e) => setS({ ...s, price_premium_3m: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">پرمیوم ۶ ماه</label>
                <input className="input py-2" inputMode="decimal" value={String(s.price_premium_6m)} onChange={(e) => setS({ ...s, price_premium_6m: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">پرمیوم ۱۲ ماه</label>
                <input className="input py-2" inputMode="decimal" value={String(s.price_premium_12m)} onChange={(e) => setS({ ...s, price_premium_12m: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <label className="mb-2 block text-sm font-bold">اعلان صفحه اصلی (اختیاری)</label>
            <input className="input" placeholder="مثلاً: خوش آمدید!" value={s.notice} onChange={(e) => setS({ ...s, notice: e.target.value })} />
          </div>

          <button className="btn-primary flex items-center gap-2" onClick={save}>
            <Save size={15} /> {saved ? 'ذخیره شد ✓' : 'ذخیره تنظیمات'}
          </button>
        </div>
      )}

      {tab === 'orders' && (
        <div className="mt-6 space-y-6">
          {awaiting.length > 0 && (
            <div>
              <h2 className="section-title mb-3">در صف تحویل ({faNum(awaiting.length)})</h2>
              <div className="space-y-2">
                {awaiting.map((o) => (
                  <div key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{o.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted">
                        {STATUS_FA[o.status] || o.status} — {o.payMethod === 'wallet' ? 'پرداخت با کیف پول سایت' : 'پرداخت با TON'} — {new Date(o.createdAt).toLocaleString('fa-IR')}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold tabular"><TonDiamond className="text-ton" /> {fmtTon(o.amountTon)}</span>
                      <button className="btn-primary btn-sm" onClick={() => orderAction(o.id, 'deliver')} title="تحویل انجام شد">
                        <PackageCheck size={13} /> تحویل شد
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => orderAction(o.id, 'complete')}>تکمیل</button>
                      <button className="btn-ghost btn-sm" onClick={() => orderAction(o.id, 'refund')} title="بازگشت مبلغ به خریدار">
                        <RotateCcw size={12} /> برگشت مبلغ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h2 className="section-title mb-3">همهٔ سفارش‌ها ({faNum(orders.length)})</h2>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="ftable min-w-[560px]">
                  <thead><tr><th>نوع</th><th>عنوان</th><th>مبلغ</th><th>کارمزد</th><th>پرداخت</th><th>وضعیت</th><th>زمان</th><th /></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="cursor-default">
                        <td className="text-xs">{o.kind}</td><td className="text-xs">{o.title}</td>
                        <td className="whitespace-nowrap"><TonDiamond className="text-ton" /> {fmtTon(o.amountTon)}</td>
                        <td className="whitespace-nowrap text-muted">{fmtTon(o.feeTon)}</td>
                        <td className="text-xs text-muted">{o.payMethod === 'wallet' ? 'کیف پول' : o.payMethod === 'ton' ? 'TON' : '—'}</td>
                        <td className="text-xs">{STATUS_FA[o.status] || o.status}</td>
                        <td className="text-xs text-muted">{new Date(o.createdAt).toLocaleDateString('fa-IR')}</td>
                        <td>
                          {!['DONE', 'REFUNDED'].includes(o.status) && (
                            <div className="flex gap-1">
                              {o.status !== 'DELIVERED' && <button className="btn-ghost btn-sm" onClick={() => orderAction(o.id, 'deliver')} title="تحویل شد"><PackageCheck size={12} /></button>}
                              <button className="btn-ghost btn-sm text-bad" onClick={() => orderAction(o.id, o.payMethod === 'wallet' ? 'refund' : 'fail')} title="لغو و برگشت">
                                <XCircle size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {orders.length === 0 && <div className="py-8 text-center text-xs text-muted">سفارشی نیست</div>}
            </div>
          </div>
          <div>
            <h2 className="section-title mb-3">کارمزدها</h2>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="ftable min-w-[520px]">
                  <thead><tr><th>بخش</th><th>مبلغ</th><th>کیف پول</th><th>وضعیت</th><th /></tr></thead>
                  <tbody>
                    {fees.map((f) => (
                      <tr key={f.id} className="cursor-default">
                        <td>{f.section}</td>
                        <td className="whitespace-nowrap"><TonDiamond className="text-ton" /> {fmtTon(f.amountTon)}</td>
                        <td className="text-xs" dir="ltr">{f.wallet.startsWith('(') ? f.wallet : `${f.wallet.slice(0, 8)}…`}</td>
                        <td className={`text-xs font-bold ${f.status === 'PAID' ? 'text-ok' : 'text-[#FBBF24]'}`}>{f.status === 'PAID' ? 'پرداخت شد' : 'در انتظار'}</td>
                        <td>
                          {f.status === 'PENDING' && (
                            <button className="btn-ghost btn-sm" onClick={() => markPaid(f.id)}>
                              <CheckCircle2 size={12} /> پرداخت شد
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fees.length === 0 && <div className="py-8 text-center text-xs text-muted">کارمزدی ثبت نشده</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ftable min-w-[560px]">
              <thead><tr><th>#</th><th>کیف پول</th><th>تلگرام</th><th>موجودی سایت</th><th>نقش</th><th>عضویت</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="cursor-default">
                    <td>{faNum(u.id)}</td>
                    <td className="text-xs" dir="ltr">{u.wallet ? `${u.wallet.slice(0, 8)}…` : '—'}</td>
                    <td className="text-xs" dir="ltr">{u.telegramId || '—'}</td>
                    <td className="whitespace-nowrap text-xs tabular">{u.balanceTon != null ? `${fmtTon(u.balanceTon)} TON` : '—'}</td>
                    <td className={`text-xs font-bold ${u.role === 'ADMIN' ? 'text-ok' : 'text-muted'}`}>{u.role === 'ADMIN' ? 'مدیر' : 'کاربر'}</td>
                    <td className="text-xs text-muted">{new Date(u.createdAt).toLocaleDateString('fa-IR')}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost btn-sm" onClick={() => creditUser(u)} title="شارژ دستی کیف پول">
                          <Wallet2 size={12} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => toggleRole(u)}>{u.role === 'ADMIN' ? 'سلب مدیریت' : 'ارتقا به مدیر'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'listings' && (
        <div className="mt-6 max-w-2xl space-y-5">
          <div className="card space-y-3 p-5">
            <div className="text-sm font-bold">افزودن لیستینگ محلی (آیتم‌های سایت)</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input" placeholder="نام — مثلاً @myname یا Toy Bear #123" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
              <select className="input" value={nf.kind} onChange={(e) => setNf({ ...nf, kind: e.target.value })}>
                <option value="gift">گیفت</option>
                <option value="username">یوزرنیم</option>
                <option value="number">شماره</option>
              </select>
              <input className="input" dir="ltr" placeholder="کیف پول فروشنده (EQ…/UQ…)" value={nf.owner} onChange={(e) => setNf({ ...nf, owner: e.target.value })} />
              <input className="input" dir="ltr" placeholder="آدرس NFT روی زنجیره (اختیاری، برای تحویل واقعی)" value={nf.nft} onChange={(e) => setNf({ ...nf, nft: e.target.value })} />
              <input className="input" placeholder="قیمت خرید (TON)" value={nf.price} onChange={(e) => setNf({ ...nf, price: e.target.value })} inputMode="decimal" />
              <input className="input" placeholder="اجاره هر روز (TON)" value={nf.rent} onChange={(e) => setNf({ ...nf, rent: e.target.value })} inputMode="decimal" />
              <input className="input" placeholder="حداقل روز اجاره" value={nf.min} onChange={(e) => setNf({ ...nf, min: e.target.value })} inputMode="numeric" />
              <input className="input" placeholder="حداکثر روز اجاره" value={nf.max} onChange={(e) => setNf({ ...nf, max: e.target.value })} inputMode="numeric" />
            </div>
            <button className="btn-primary" onClick={addListing}>افزودن لیستینگ</button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ftable min-w-[520px]">
                <thead><tr><th>نام</th><th>نوع</th><th>قیمت خرید</th><th>اجاره/روز</th><th>NFT</th><th>وضعیت</th><th /></tr></thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id} className="cursor-default">
                      <td className="font-bold">{l.name}</td>
                      <td className="text-xs text-muted">{l.kind === 'gift' ? 'گیفت' : l.kind === 'username' ? 'یوزرنیم' : 'شماره'}</td>
                      <td>{l.priceTon ? fmtTon(l.priceTon) : '—'}</td>
                      <td>{l.rentPerDayTon ? fmtTon(l.rentPerDayTon) : '—'}</td>
                      <td className="text-xs text-muted">{l.nftAddress ? '✓' : '—'}</td>
                      <td className="text-xs">{l.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}</td>
                      <td><button className="btn-ghost btn-sm text-bad" onClick={() => delListing(l.id)}>حذف</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {listings.length === 0 && <div className="py-8 text-center text-xs text-muted">لیستینگی نیست</div>}
          </div>
        </div>
      )}

      {tab === 'updates' && (
        <div className="mt-6 max-w-2xl space-y-5">
          {/* نسخه فعلی */}
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <div className="text-sm font-bold">نسخهٔ فعلی گیفتیفای</div>
              <div className="mt-1 text-xs text-muted">
                کد نصب‌شده روی هاست: <span className="font-bold text-ink" dir="ltr">v{updatesInfo?.code_version || '…'}</span>
                {updatesInfo && updatesInfo.updates.length > 0 && (
                  <span> — آخرین به‌روزرسانی اعمال‌شده: <span className="font-bold text-accent-hi" dir="ltr">v{updatesInfo.updates[0].version}</span></span>
                )}
              </div>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => fetch('/api/admin/updates', { cache: 'no-store' }).then((r) => r.json()).then(setUpdatesInfo).catch(() => {})}>
              <RefreshCw size={13} /> بروزرسانی فهرست
            </button>
          </div>

          {/* بارگذاری فایل */}
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Upload size={15} className="text-accent-hi" /> بارگذاری فایل به‌روزرسانی
            </div>
            <p className="mt-2 text-xs leading-6 text-muted">
              فایل <span dir="ltr" className="font-bold">giftify-update-…json</span> که برایتان ارسال می‌شود را اینجا انتخاب کنید؛ تغییرات تنظیمات (کارمزد، قیمت، اعلان و…) فوراً اعمال و در تاریخچهٔ پایین ثبت می‌شود.
              برای تغییرات کد، ابتدا ZIP جدید را روی هاست جایگزین کنید — خود فایل، تاریخچهٔ تغییرات را ثبت می‌کند.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="input max-w-xs cursor-pointer py-2 text-xs"
                disabled={applying}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) applyUpdateFile(f);
                }}
              />
              {applying && <span className="spin" />}
            </div>
            {updateMsg && (
              <div className={`mt-3 rounded-lg border px-4 py-2.5 text-xs leading-6 ${updateMsg.ok ? 'border-ok/30 bg-ok/10 text-ok' : 'border-bad/30 bg-bad/10 text-bad'}`}>
                {updateMsg.text}
              </div>
            )}
          </div>

          {/* تاریخچه */}
          <div>
            <h2 className="section-title mb-3 flex items-center gap-2">
              <History size={15} /> تاریخچهٔ به‌روزرسانی‌ها
            </h2>
            {updatesInfo && updatesInfo.updates.length === 0 && (
              <div className="card p-6 text-center text-xs leading-6 text-muted">
                هنوز فایلی اعمال نشده. اولین فایل به‌روزرسانی (مثل <span dir="ltr">giftify-update-v3.1.0.json</span> همراه بستهٔ نصب) را بارگذاری کنید.
              </div>
            )}
            <div className="space-y-3">
              {updatesInfo?.updates.map((u) => (
                <div key={u.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent-hi" dir="ltr">v{u.version}</span>
                      <span className="text-sm font-bold">{u.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      {u.appliedSettings && <span className="pill bg-ok/15 text-ok">تنظیمات اعمال شد</span>}
                      {u.fileName && <span dir="ltr" className="max-w-[180px] truncate">{u.fileName}</span>}
                      <span>{new Date(u.appliedAt).toLocaleString('fa-IR')}</span>
                    </div>
                  </div>
                  {u.changes.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {u.changes.map((c, i) => {
                        const meta = CHANGE_META[c.type] || CHANGE_META.other;
                        const Icon = meta.Icon;
                        return (
                          <li key={i} className="flex items-start gap-2 text-xs leading-6">
                            <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                              <Icon size={10} /> {meta.label}
                            </span>
                            <span className="text-muted">{c.text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
