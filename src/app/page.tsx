import { Suspense } from 'react';
import { MarketView } from '@/components/MarketView';

export const dynamic = 'force-dynamic';

export default function UsernamesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <MarketView
        section="usernames"
        title="خرید و فروش یوزرنیم"
        subtitle="یوزرنیم تلگرام خود را با امنیت بلاکچین TON بخرید، بفروشید یا اجاره دهید و از آن به‌عنوان لینک پروفایل، گروه یا کانال استفاده کنید."
        searchPlaceholder="جستجوی یوزرنیم…"
        listTitle="حراج‌ها و فروش‌ها"
      />
    </Suspense>
  );
}
