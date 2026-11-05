import { Suspense } from 'react';
import { AdminInner } from '@/components/AdminInner';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="spin" /></div>}>
      <AdminInner />
    </Suspense>
  );
}
