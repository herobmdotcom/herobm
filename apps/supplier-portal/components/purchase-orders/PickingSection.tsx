'use client';

/**
 * PickingSection — supplier-portal wrapper.
 * Disables the shipped-quantity floor check (supplier-portal behavior).
 */
import { PickingSection as SharedPickingSection } from '@modbm/portal-ui';

export default function PickingSection(props: {
  orderId: string;
  orderState: string;
  orderLines: { salesOrderLineId: string; lineNumber: number; productId: string; productDescription: string; quantity: string }[];
  onOrderUpdated: (autoTransitions?: any[]) => void;
}) {
  return <SharedPickingSection {...props} enableShippedFloorCheck={false} />;
}
