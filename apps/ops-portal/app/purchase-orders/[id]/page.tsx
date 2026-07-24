import EditPurchaseOrderClient from './EditPurchaseOrderClient';
import { useTranslations } from 'next-intl';

export const metadata = {
  title: 'Purchase Order | HeroBM',
};

export default async function PurchaseOrderPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <EditPurchaseOrderClient id={params.id} />;
}
