import { Suspense } from 'react';
import { MarketView } from '@/components/MarketView';

export const dynamic = 'force-dynamic';

export default function GiftsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <MarketView
        section="gifts"
        title="گیفت‌های کلکسیونی تلگرام"
        subtitle="گیفت‌های به‌روزرسانی‌شده را اجاره بگیرید یا از لیستینگ‌های سایت بخرید — مدل، پس‌زمینه، نماد و شمارهٔ هر گیفت یکتاست و روی بلاکچین TON ثبت شده است."
        searchPlaceholder="جستجوی نام، ویژگی‌ها یا کالکشن…"
        listTitle="گیفت‌های اجاره‌دار"
        showCollections
      />
    </Suspense>
  );
}
