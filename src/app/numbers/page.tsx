import { Suspense } from 'react';
import { MarketView } from '@/components/MarketView';

export const dynamic = 'force-dynamic';

export default function NumbersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <MarketView
        section="numbers"
        title="اجاره و خرید شماره‌های کلکسیونی"
        subtitle="آی‌دی‌های ناشناس و کلکسیونی تلگرام — مستقل از سیم‌کارت و متصل به کیف پول بلاکچین شما. شماره‌های +888 را اجاره بگیرید."
        searchPlaceholder="+888  جستجوی شماره یا لینک t.me…"
        listTitle="شماره‌های اجاره‌دار"
      />
    </Suspense>
  );
}
