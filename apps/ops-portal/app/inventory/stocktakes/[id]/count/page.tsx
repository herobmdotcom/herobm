import { Metadata } from 'next';
import StocktakeClient from '../../../stocktake/StocktakeClient';

export const metadata: Metadata = {
  title: 'Stocktake Terminal',
};

export default async function StocktakeTerminalPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  return <StocktakeClient stocktakeId={params.id} />;
}
