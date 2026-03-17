'use client';

/**
 * PickingSection — sales-portal wrapper.
 * Enables the shipped-quantity floor check (sales-specific behavior).
 */
import { PickingSection as SharedPickingSection } from '@modbm/portal-ui';

export default function PickingSection(props: {
  orderId: string;
  orderState: string;
  orderLines: { salesOrderLineId: string; lineNumber: number; productId: string; productDescription: string; quantity: string }[];
  onOrderUpdated: (autoTransitions?: any[]) => void;
}) {
  return <SharedPickingSection {...props} enableShippedFloorCheck={true} />;
}
