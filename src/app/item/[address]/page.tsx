import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getItemInfo } from '@/lib/market';
import { resolveImage } from '@/lib/images';
import { giftImageFromItemName, telegramLinkFromItemName } from '@/lib/giftimg';
import { db } from '@/lib/db';
import { fmtTon, faNum, shortAddr, attrOf } from '@/lib/format';
import { StatusPill, TonDiamond } from '@/components/ui-bits';
import { ItemActions } from '@/components/ItemActions';
import { ItemImageLarge } from '@/components/ItemImage';

export const dynamic = 'force-dynamic';

export default async function ItemPage({ params }: { params: Promise<{ address: string }> }) {
  // Next.js پارامتر را انکود نگه می‌دارد (مثلاً local%3A... یا آدرس با کاراکتر خاص) — دیکود کن
  const raw = decodeURIComponent((await params).address);

  // لیستینگ محلی سایت
  if (raw.startsWith('local:')) {
    const id = raw.replace('local:', '');
    const row = await db.localListing.findUnique({ where: { id } }).catch(() => null);
    if (!row) notFound();
    const num = row.itemNum ?? (row.name.match(/#(\d+)/) ? Number(row.name.match(/#(\d+)/)![1]) : null);
    const img = giftImageFromItemName(row.name) ?? (await resolveImage({ address: raw, kind: 'gift', collectionSlug: row.collectionSlug, itemNum: num }).catch(() => null));
    return (
      <div className="mx-auto grid max-w-4xl gap-6 py-6 md:grid-cols-2">
        <div className="card flex items-center justify-center p-6">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={row.name} className="max-h-80 rounded-xl" />
          ) : (
            <ItemImageLarge name={row.name} address={raw} kind={row.kind === 'gift' ? 'gifts' : row.kind === 'username' ? 'usernames' : 'numbers'} />
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <StatusPill kind="local" />
            {row.rentPerDayTon ? <StatusPill kind="rent" /> : null}
            {row.priceTon ? <StatusPill kind="buy" /> : null}
          </div>
          <h1 className="text-2xl font-black">{row.name}</h1>
          <div className="mt-1 text-sm text-muted">لیستینگ سایت — {row.kind === 'gift' ? 'گیفت' : row.kind === 'username' ? 'یوزرنیم' : 'شماره کلکسیونی'}</div>
          {row.priceTon && (
            <div className="mt-4 text-xl font-bold tabular">
              <TonDiamond className="text-ton" /> {fmtTon(row.priceTon)} TON
            </div>
          )}
          {row.rentPerDayTon && (
            <div className="mt-1 text-lg font-bold text-ok tabular">
              اجاره: <TonDiamond className="text-ton" /> {fmtTon(row.rentPerDayTon)} / روز
              <span className="text-xs font-normal text-muted"> ({faNum(row.rentMinDays ?? 1)} تا {faNum(row.rentMaxDays ?? 30)} روز)</span>
            </div>
          )}
          <div className="mt-4 rounded-lg border border-line bg-panel2 px-4 py-3 text-xs text-muted" dir="ltr">
            فروشنده: {row.ownerWallet}
          </div>
          <ItemActions
            kind={row.kind === 'username' ? 'usernames' : row.kind === 'number' ? 'numbers' : 'gifts'}
            name={row.name}
            image={img}
            attrs={[]}
            local={row.id}
            priceTon={row.priceTon ?? null}
            rentPerDayTon={row.rentPerDayTon ?? null}
            minDurationSec={(row.rentMinDays ?? 1) * 86400}
            maxDurationSec={(row.rentMaxDays ?? 30) * 86400}
          />
        </div>
      </div>
    );
  }

  const info = await getItemInfo(raw);
  if (!info.ok && info.tokenInvalid) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center text-sm leading-7">
        این آیتم موقتاً در دسترس نیست — چند لحظه بعد دوباره تلاش کنید یا از بازار استفاده کنید.
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/gifts" className="btn-primary btn-sm">بازار گیفت‌ها</Link>
          <Link href="/rent" className="btn-ghost btn-sm">بخش اجاره</Link>
        </div>
      </div>
    );
  }
  if (!info.ok) notFound();

  const num = info.name.match(/#(\d+)/) ? Number(info.name.match(/#(\d+)/)![1]) : null;
  const model = attrOf(info.attrs, 'Model');
  const kind = info.name.startsWith('+888') ? 'numbers' : info.name.startsWith('@') || info.collectionAddress?.toLowerCase().includes('username') ? 'usernames' : 'gifts';
  const image = await resolveImage({ address: raw, kind: 'gift', itemNum: num }).catch(() => null);
  const tgLink = telegramLinkFromItemName(info.name);

  const d = info.details || {};

  return (
    <div className="mx-auto grid max-w-4xl gap-6 py-6 md:grid-cols-2">
      <div className="card flex items-center justify-center p-6">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={info.name} className="max-h-80 rounded-xl" />
        ) : (
          <ItemImageLarge name={info.name} address={raw} kind={kind} />
        )}
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {info.status === 'for_rent' && <StatusPill kind="rent" />}
          {info.status === 'rented' && <StatusPill kind="rent" label="در حال اجاره" />}
          {info.status === 'for_sale' && <StatusPill kind="buy" />}
          {info.status === 'on_auction' && <StatusPill kind="auction" />}
          {info.status === 'for_sale_and_rent' && (
            <>
              <StatusPill kind="buy" />
              <StatusPill kind="rent" />
            </>
          )}
          {info.status === 'not_for_sale' && <StatusPill kind="resale" label="غیرقابل خرید" />}
        </div>
        <h1 className="text-2xl font-black">{info.name}</h1>
        {info.collectionName && <div className="mt-1 text-sm text-muted">{info.collectionName}</div>}

        <div className="mt-4 space-y-1.5 text-sm">
          {d.pricePerDayTon != null && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">اجاره هر روز</span>
              <span className="font-bold text-ok tabular"><TonDiamond className="text-ton" /> {fmtTon(d.pricePerDayTon)}</span>
            </div>
          )}
          {d.minDurationSec != null && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">بازهٔ مدت اجاره</span>
              <span className="font-bold tabular">{faNum(Math.round(d.minDurationSec / 86400))} تا {faNum(Math.round((d.maxDurationSec ?? d.minDurationSec) / 86400))} روز</span>
            </div>
          )}
          {d.priceTon && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">قیمت</span>
              <span className="font-bold tabular"><TonDiamond className="text-ton" /> {fmtTon(d.priceTon)} {d.currency || 'TON'}</span>
            </div>
          )}
          {d.minBidTon != null && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">حداقل پیشنهاد</span>
              <span className="font-bold tabular"><TonDiamond className="text-ton" /> {fmtTon(d.minBidTon)}</span>
            </div>
          )}
          {model !== '—' && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">مدل</span>
              <span className="font-bold">{model}</span>
            </div>
          )}
          {info.owner && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">مالک</span>
              <span className="text-xs" dir="ltr">{shortAddr(info.owner)}</span>
            </div>
          )}
        </div>

        <ItemActions
          kind={kind}
          name={info.name}
          image={image}
          address={raw}
          attrs={info.attrs}
          priceTon={d.priceTon ?? null}
          currency={d.currency || 'TON'}
          rentPerDayTon={d.pricePerDayTon ?? null}
          minDurationSec={d.minDurationSec ?? null}
          maxDurationSec={d.maxDurationSec ?? null}
        />

        {tgLink && (
          <a href={tgLink} target="_blank" rel="noreferrer" className="mt-4 block text-center text-xs text-accent-hi hover:underline">
            مشاهده در تلگرام ↗
          </a>
        )}
      </div>
    </div>
  );
}
