import { Metadata } from 'next';
import TransferDetailsClient from './TransferDetailsClient';

export const metadata: Metadata = {
  title: 'Transfer',
};

export default async function TransferDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <TransferDetailsClient id={params.id} />;
}
