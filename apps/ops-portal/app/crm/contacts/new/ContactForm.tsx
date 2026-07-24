'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import { reportError } from '@/lib/api';
import { contactsControllerCreate, contactsControllerUpdate } from '@herobm/sdk';
import { useTranslations } from 'next-intl';

import { toast } from 'react-hot-toast';

interface ContactFormProps {
  isNew?: boolean;
  contactId?: string;
}

export default function ContactForm({ isNew, contactId }: ContactFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    try {
      const data = {
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
        email: (formData.get('email') as string) || undefined,
        phone: (formData.get('phone') as string) || undefined,
        jobTitle: (formData.get('jobTitle') as string) || undefined,
      };

      if (isNew) {
        await contactsControllerCreate(data);
      } else {
        if (!contactId) throw new Error('Missing contactId');
        await contactsControllerUpdate(contactId, data);
      }

      toast.success(isNew ? 'Contact created' : 'Contact updated');
      router.push('/crm/contacts');
    } catch (err) {
      toast.error('An error occurred');
      reportError(err, 'ContactForm');
    } finally {
      setLoading(false);
    }
  }

  const title = isNew ? 'Create Contact' : 'Edit Contact';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">First Name *</label>
            <input className="border rounded px-3 py-2 w-full" name="firstName" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last Name *</label>
            <input className="border rounded px-3 py-2 w-full" name="lastName" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input className="border rounded px-3 py-2 w-full" name="email" type="email" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input className="border rounded px-3 py-2 w-full" name="phone" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Job Title</label>
          <input className="border rounded px-3 py-2 w-full" name="jobTitle" />
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
