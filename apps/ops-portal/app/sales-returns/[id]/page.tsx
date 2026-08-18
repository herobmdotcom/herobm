import SalesReturnDetailContent from './SalesReturnDetailContent';

export const metadata = {
  title: 'Sales Return',
};

export default async function SalesReturnPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <SalesReturnDetailContent id={params.id} />;
}
