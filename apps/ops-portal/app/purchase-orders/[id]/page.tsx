import EditPurchaseOrderClient from './EditPurchaseOrderClient';
 
export const metadata = {
  title: 'Purchase Order',
};

export default async function PurchaseOrderPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <EditPurchaseOrderClient id={params.id} />;
}
