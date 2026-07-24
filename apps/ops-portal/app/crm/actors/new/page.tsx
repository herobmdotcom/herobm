import { Metadata } from 'next';
import ActorForm from './ActorForm';

export const metadata: Metadata = {
  title: 'New Actor - CRM',
};

export default function NewActorPage() {
  return <ActorForm isNew />;
}
