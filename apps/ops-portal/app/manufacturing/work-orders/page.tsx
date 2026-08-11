import { Metadata } from 'next';
import WorkOrdersContent from './WorkOrdersContent';

export const metadata: Metadata = {
  title: 'Work Orders | Manufacturing',
};

export default function WorkOrdersPage() {
  return <WorkOrdersContent />;
}
