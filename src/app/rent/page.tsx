import { Suspense } from 'react';
import { RentView } from '@/components/RentView';

export const dynamic = 'force-dynamic';

export default function RentPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <RentView />
    </Suspense>
  );
}
