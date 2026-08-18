import { Metadata } from 'next';
import WorkOrdersContent from './WorkOrdersContent';

export const metadata: Metadata = {
  title: 'Work Orders',
};

export default function WorkOrdersPage() {
  return <WorkOrdersContent />;
}
