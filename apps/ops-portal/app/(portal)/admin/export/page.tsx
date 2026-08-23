import { redirect } from 'next/navigation';

export default function ExportIndexPage() {
  redirect('/admin/export/csv');
}
