import { redirect } from 'next/navigation';

export default function ImportIndexPage() {
  redirect('/admin/import/csv');
}
