import { Metadata } from 'next';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'New Contact',
};

export default function NewContactPage() {
  return <ContactForm isNew />;
}
