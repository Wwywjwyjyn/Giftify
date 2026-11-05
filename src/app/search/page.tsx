import { Suspense } from 'react';
import { SearchView } from '@/components/SearchView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'نتایج جستجو' };

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <SearchView />
    </Suspense>
  );
}
