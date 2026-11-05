import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getItemInfo } from '@/lib/market';
import { resolveImage, giftImageUrlFromSlug } from '@/lib/images';
import { db } from '@/lib/db';
import { fmtTon, faNum, shortAddr, attrOf } from '@/lib/format';
import { StatusPill, TonDiamond } from '@/components/ui-bits';
import { ItemActions } from '@/components/ItemActions';

export const dynamic = 'force-dynamic';

export default async function ItemPage({ params }: { params: Promise<{ address: string }> }) {
  const { address: raw } = await params;

  // لیستینگ محلی
  if (raw.startsWith('local:')) {
    const id = raw.replace('local:', '');
    const row = await db.localListing.findUnique({ where: { id } }).catch(() => null);
    if (!row) notFound();
    const num = row.itemNum ?? (row.name.match(/#(\d+)/) ? Number(row.name.match(/#(\d+)/)![1]) : null);
    const img = row.collectionSlug && num ? giftImageUrlFromSlug(row.collectionSlug, num) : null;
    return (
      <div className="mx-auto grid max-w-4xl gap-6 py-6 md:grid-cols-2">
        <div className="card flex items-center justify-center p-6">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={row.name} className="max-h-80 rounded-xl" />
          ) : (
            <div className="flex h-64 w-full items-center justify-center rounded-xl bg-gradient-to-br from-panel2 to-[#22303F] text-6xl font-black text-accent-hi/60">
              {row.name.slice(0, 1)}
            </div>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <StatusPill kind="local" />
            {row.rentPerDayTon ? <StatusPill kind="rent" /> : null}
          </div>
          <h1 className="text-2xl font-black">{row.name}</h1>
          <div className="mt-1 text-sm text-muted">لیستینگ محلی {row.kind === 'gift' ? 'گیفت' : row.kind === 'username' ? 'یوزرنیم' : 'شماره'}</div>
          {row.priceTon && (
            <div className="mt-4 text-xl font-bold">
              <TonDiamond className="text-ton" /> {fmtTon(row.priceTon)}
            </div>
          )}
          {row.rentPerDayTon && (
            <div className="mt-1 text-lg font-bold text-ok">
              اجاره: <TonDiamond className="text-ton" /> {fmtTon(row.rentPerDayTon)} / روز
              <span className="text-xs font-normal text-muted"> ({faNum(row.rentMinDays ?? 1)} تا {faNum(row.rentMaxDays ?? 30)} روز)</span>
            </div>
          )}
          <div className="mt-4 rounded-lg border border-line bg-panel2 px-4 py-3 text-xs leading-6 text-muted" dir="ltr">
            {row.ownerWallet}
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
  if (!info.ok && (info as { tokenInvalid?: boolean }).tokenInvalid) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center text-sm leading-7">
        توکن API مارکت‌اپ نامعتبر یا منقضی است. از <span dir="ltr" className="font-bold">marketapp.org/api-token</span> توکن جدید بگیرید و در <span dir="ltr" className="font-bold">.env</span> جایگزین کنید.
        <div className="mt-4">
          <Link href="/gifts" className="btn-ghost">بازگشت به بازار</Link>
        </div>
      </div>
    );
  }
  if (!info.ok && info.paid) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center text-sm leading-7">
        نمایش این آیتم نیازمند پلن API مارکت‌اپ است. با فعال‌سازی پلن این صفحه به‌صورت خودکار کامل می‌شود.
        <div className="mt-4">
          <Link href="/gifts" className="btn-ghost">بازگشت به بازار</Link>
        </div>
      </div>
    );
  }
  if (!info.ok) notFound();

  const num = info.name.match(/#(\d+)/) ? Number(info.name.match(/#(\d+)/)![1]) : null;
  const model = attrOf(info.attrs, 'Model');
  const image = await resolveImage({ address: raw, kind: 'gift', itemNum: num }).catch(() => null);
  const tgLink = image?.match(/nft\.fragment\.com\/gift\/([a-z0-9]+)-(\d+)\.webp/i)
    ? `https://t.me/nft/${image.match(/nft\.fragment\.com\/gift\/([a-z0-9]+)-(\d+)\.webp/i)![1]}`
    : null;

  const d = info.details || {};
  const kind = info.name.startsWith('+888') ? 'numbers' : info.name.startsWith('@') || info.collectionAddress?.toLowerCase().includes('username') ? 'usernames' : 'gifts';

  return (
    <div className="mx-auto grid max-w-4xl gap-6 py-6 md:grid-cols-2">
      <div className="card flex items-center justify-center p-6">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={info.name} className="max-h-80 rounded-xl" />
        ) : (
          <div className="flex h-64 w-full items-center justify-center rounded-xl bg-gradient-to-br from-panel2 to-[#22303F] text-6xl font-black text-accent-hi/60">
            {info.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {info.status === 'for_sale' && <StatusPill kind="sale" />}
          {info.status === 'on_auction' && <StatusPill kind="auction" />}
          {info.status === 'for_rent' && <StatusPill kind="rent" />}
          {info.status === 'rented' && <StatusPill kind="rent" label="در حال اجاره" />}
          {(info.status === 'for_sale_and_rent' || info.status === 'for_sale_and_rent') && (
            <>
              <StatusPill kind="sale" />
              <StatusPill kind="rent" />
            </>
          )}
          {info.status === 'not_for_sale' && <StatusPill kind="resale" label="غیرقابل فروش" />}
        </div>
        <h1 className="text-2xl font-black">{info.name}</h1>
        {info.collectionName && <div className="mt-1 text-sm text-muted">{info.collectionName}</div>}

        <div className="mt-4 space-y-1.5 text-sm">
          {d.priceTon && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">قیمت</span>
              <span className="font-bold"><TonDiamond className="text-ton" /> {fmtTon(d.priceTon)} {d.currency || 'TON'}</span>
            </div>
          )}
          {d.minBidTon != null && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">حداقل پیشنهاد</span>
              <span className="font-bold"><TonDiamond className="text-ton" /> {fmtTon(d.minBidTon)}</span>
            </div>
          )}
          {d.pricePerDayTon != null && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">قیمت اجاره هر روز</span>
              <span className="font-bold text-ok"><TonDiamond className="text-ton" /> {fmtTon(d.pricePerDayTon)}</span>
            </div>
          )}
          {d.endTimeSec && (
            <div className="flex items-center justify-between rounded-lg bg-panel2 px-4 py-2.5">
              <span className="text-muted">زمان پایان</span>
              <span className="font-bold">{new Date(d.endTimeSec * 1000).toLocaleString('fa-IR')}</span>
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
          priceTon={d.priceTon ?? d.minBidTon ?? null}
          currency={d.currency || 'TON'}
          rentPerDayTon={d.pricePerDayTon ?? null}
          minDurationSec={d.minDurationSec ?? null}
          maxDurationSec={d.maxDurationSec ?? null}
          onAuction={info.status === 'on_auction'}
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
