import { Suspense } from 'react';
import { MarketView } from '@/components/MarketView';

export const dynamic = 'force-dynamic';

export default function GiftsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <MarketView
        section="gifts"
        title="گیفت‌های کلکسیونی تلگرام"
        subtitle="گیفت‌های به‌روزرسانی‌شده را بخرید، بفروشید یا اجاره بگیرید — مدل، پس‌زمینه، نماد و شماره هر گیفت یکتاست و روی بلاکچین TON ثبت شده است."
        searchPlaceholder="جستجوی نام و ویژگی‌ها…"
        listTitle="گیفت‌های برتر"
        showCollections
      />
    </Suspense>
  );
}
