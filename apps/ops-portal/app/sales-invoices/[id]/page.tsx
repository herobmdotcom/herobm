import InvoiceDetailContent from './InvoiceDetailContent';

export const metadata = {
  title: 'Sales Invoice | ModBM',
};

export default async function SalesInvoicePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <InvoiceDetailContent id={params.id} />;
}
