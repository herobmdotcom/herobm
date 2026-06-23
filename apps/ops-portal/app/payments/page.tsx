import PaymentsContent from './PaymentsContent';
import { Suspense } from 'react';

export const metadata = {
  title: 'Payments | HeroBM',
};

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div />}>
      <PaymentsContent />
    </Suspense>
  );
}
