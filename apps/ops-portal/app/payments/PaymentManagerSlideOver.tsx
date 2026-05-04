'use client';

import { useState, useEffect } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';

interface Props {
  paymentId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function PaymentManagerSlideOver({ paymentId, onClose, onSaved }: Props) {
  const tCommon = useTranslations('common');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (paymentId) {
      setLoading(true);
      fetch(`/api/payments/${paymentId}`)
        .then(res => res.json())
        .then(setData)
        .finally(() => setLoading(false));
    }
  }, [paymentId]);

  return (
    <SlideOver
      isOpen={true}
      onClose={onClose}
      title={paymentId ? `Payment: ${data?.paymentNumber || '...'}` : 'New Payment Entry'}
    >
      <div className="p-6">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div>
            {!paymentId ? (
              <p>Creation form goes here. Under construction.</p>
            ) : (
              <div>
                <p>Status: {data?.stateCode}</p>
                <p>Amount: {data?.totalAmount}</p>
                <p>Unallocated: {data?.unallocatedAmount}</p>
                
                <h3 className="mt-6 text-lg font-bold">Allocations</h3>
                {data?.allocations?.length === 0 ? (
                  <p className="text-gray-500">No allocations yet.</p>
                ) : (
                  <ul className="mt-4 border rounded divide-y">
                    {data?.allocations?.map((a: any) => (
                      <li key={a.allocationId} className="p-3">
                        {a.referenceType} ({a.referenceId}) - {a.allocatedAmount}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            
            <div className="mt-8 flex justify-end gap-3">
              <button className="btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
