import ContactsContent from './ContactsContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contacts - CRM',
};

export default function ContactsPage() {
  return <ContactsContent />;
}
