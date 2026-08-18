import { Metadata } from 'next';
import WorkOrderDetails from './WorkOrderDetails';

export const metadata: Metadata = {
  title: 'Work Order',
};

export default async function WorkOrderDetailsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  return <WorkOrderDetails workOrderId={params.id} />;
}
