'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, Save, CheckCircle2 } from 'lucide-react';
import { faNum, fmtTon } from '@/lib/format';
import { TonDiamond } from '@/components/ui-bits';

type Settings = {
  site_name: string;
  fee_wallet: string;
  fee_usernames: number;
  fee_numbers: number;
  fee_gifts: number;
  fee_rent: number;
  fee_stars: number;
  fee_premium: number;
  fee_giveaway: number;
  fee_ads: number;
  notice: string;
};
type Order = { id: string; kind: string; title: string; amountTon: number; feeTon: number; status: string; createdAt: string };
type FeeRow = { id: string; section: string; amountTon: number; wallet: string; status: string; createdAt: string };
type User = { id: number; role: string; wallet?: string; telegramId?: string; name?: string; createdAt: string };
type Listing = { id: string; kind: string; name: string; priceTon?: number; rentPerDayTon?: number; status: string; ownerWallet: string };
type Health = { token_set?: boolean; token_valid?: boolean; sale_feed?: boolean; telegram?: boolean };

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

export function AdminInner() {
  const [tab, setTab] = useState<'fees' | 'orders' | 'users' | 'listings'>('fees');
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [health, setHealth] = useState<Health>({});
  const [denied, setDenied] = useState(false);
  const [nf, setNf] = useState({ name: '', kind: 'gift', price: '', rent: '', min: '1', max: '30' });

  const loadAll = useCallback(async () => {
    const sr = await fetch('/api/admin/settings', { cache: 'no-store' });
    if (sr.status === 403) { setDenied(true); return; }
    setS(await sr.json());
    fetch('/api/admin/orders', { cache: 'no-store' }).then((r) => r.json()).then((j) => { setOrders(j.orders || []); setFees(j.fees || []); }).catch(() => {});
    fetch('/api/admin/users', { cache: 'no-store' }).then((r) => r.json()).then((j) => setUsers(j.users || [])).catch(() => {});
    fetch('/api/admin/listings', { cache: 'no-store' }).then((r) => r.json()).then((j) => setListings(j.listings || [])).catch(() => {});
    fetch('/api/health', { cache: 'no-store' }).then((r) => r.json()).then((j) => setHealth(j)).catch(() => {});
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

  async function addListing() {
    if (!nf.name.trim()) return;
    await fetch('/api/admin/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nf.name, kind: nf.kind,
        priceTon: nf.price ? Number(nf.price) : null,
        rentPerDayTon: nf.rent ? Number(nf.rent) : null,
        rentMinDays: Number(nf.min) || 1, rentMaxDays: Number(nf.max) || 30,
      }),
    });
    setNf({ name: '', kind: nf.kind, price: '', rent: '', min: '1', max: '30' });
    loadAll();
  }

  async function delListing(id: string) {
    await fetch(`/api/admin/listings?id=${id}`, { method: 'DELETE' });
    setListings((l) => l.filter((x) => x.id !== id));
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

  return (
    <div className="py-6">
      <h1 className="hero-title">پنل مدیریت گیفتیفای</h1>

      {/* وضعیت اتصال‌ها */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4 text-sm">
          <div className="text-muted">توکن API مارکت‌اپ</div>
          <div className={`mt-1 font-bold ${health.token_valid ? 'text-ok' : 'text-bad'}`}>
            {!health.token_set ? 'تنظیم نشده ✗' : health.token_valid ? 'فعال ✓' : 'نامعتبر/منقضی ✗'}
          </div>
          {health.token_set && !health.token_valid && (
            <div className="mt-1 text-[11px] leading-5 text-muted">توکن جدید از marketapp.org/api-token بگیرید و در .env جایگزین کنید</div>
          )}
        </div>
        <div className="card p-4 text-sm">
          <div className="text-muted">فید خرید NFT (پلن API)</div>
          <div className={`mt-1 font-bold ${health.sale_feed ? 'text-ok' : 'text-[#FBBF24]'}`}>{health.sale_feed ? 'فعال ✓' : 'نیازمند پلن'}</div>
        </div>
        <div className="card p-4 text-sm">
          <div className="text-muted">ربات تلگرام (Mini App)</div>
          <div className={`mt-1 font-bold ${health.telegram ? 'text-ok' : 'text-muted'}`}>{health.telegram ? 'تنظیم شده ✓' : 'اختیاری'}</div>
        </div>
      </div>

      {/* تب‌ها */}
      <div className="mt-6 flex gap-6 border-b border-line">
        {([['fees', 'کارمزدها'], ['orders', 'سفارش‌ها و کارمزد'], ['users', 'کاربران'], ['listings', 'لیستینگ محلی']] as const).map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'fees' && (
        <div className="mt-6 max-w-2xl space-y-5">
          <div className="card p-5">
            <label className="mb-2 block text-sm font-bold">کیف پول دریافت کارمزد (آدرس TON)</label>
            <input className="input" dir="ltr" placeholder="EQ… / UQ…" value={s.fee_wallet} onChange={(e) => setS({ ...s, fee_wallet: e.target.value })} />
            <p className="mt-2 text-xs leading-6 text-muted">
              کارمزد هر بخش به این آدرس پرداخت و در «سفارش‌ها و کارمزد» به‌صورت شفاف ثبت می‌شود.
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
          <div>
            <h2 className="section-title mb-3">سفارش‌ها ({faNum(orders.length)})</h2>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="ftable min-w-[520px]">
                  <thead><tr><th>نوع</th><th>عنوان</th><th>مبلغ</th><th>کارمزد</th><th>وضعیت</th><th>زمان</th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="cursor-default">
                        <td>{o.kind}</td><td className="text-xs">{o.title}</td>
                        <td className="whitespace-nowrap"><TonDiamond className="text-ton" /> {fmtTon(o.amountTon)}</td>
                        <td className="whitespace-nowrap text-muted">{fmtTon(o.feeTon)}</td>
                        <td className="text-xs">{o.status}</td>
                        <td className="text-xs text-muted">{new Date(o.createdAt).toLocaleDateString('fa-IR')}</td>
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
                        <td className="text-xs" dir="ltr">{f.wallet.slice(0, 8)}…</td>
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
            <table className="ftable min-w-[520px]">
              <thead><tr><th>#</th><th>کیف پول</th><th>تلگرام</th><th>نقش</th><th>تاریخ عضویت</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="cursor-default">
                    <td>{faNum(u.id)}</td>
                    <td className="text-xs" dir="ltr">{u.wallet ? `${u.wallet.slice(0, 8)}…` : '—'}</td>
                    <td className="text-xs" dir="ltr">{u.telegramId || '—'}</td>
                    <td className={`text-xs font-bold ${u.role === 'ADMIN' ? 'text-ok' : 'text-muted'}`}>{u.role === 'ADMIN' ? 'مدیر' : 'کاربر'}</td>
                    <td className="text-xs text-muted">{new Date(u.createdAt).toLocaleDateString('fa-IR')}</td>
                    <td><button className="btn-ghost btn-sm" onClick={() => toggleRole(u)}>{u.role === 'ADMIN' ? 'سلب مدیریت' : 'ارتقا به مدیر'}</button></td>
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
            <div className="text-sm font-bold">افزودن لیستینگ محلی (آیتم‌های خودتان)</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input" placeholder="نام — مثلاً @myname یا Toy Bear #123" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
              <select className="input" value={nf.kind} onChange={(e) => setNf({ ...nf, kind: e.target.value })}>
                <option value="gift">گیفت</option>
                <option value="username">یوزرنیم</option>
                <option value="number">شماره</option>
              </select>
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
                <thead><tr><th>نام</th><th>نوع</th><th>قیمت خرید</th><th>اجاره/روز</th><th>وضعیت</th><th /></tr></thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id} className="cursor-default">
                      <td className="font-bold">{l.name}</td>
                      <td className="text-xs text-muted">{l.kind === 'gift' ? 'گیفت' : l.kind === 'username' ? 'یوزرنیم' : 'شماره'}</td>
                      <td>{l.priceTon ? fmtTon(l.priceTon) : '—'}</td>
                      <td>{l.rentPerDayTon ? fmtTon(l.rentPerDayTon) : '—'}</td>
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
    </div>
  );
}
