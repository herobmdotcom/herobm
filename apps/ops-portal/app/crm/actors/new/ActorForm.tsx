'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import { reportError } from '@/lib/api';
import { actorsControllerCreate, actorsControllerUpdate } from '@herobm/sdk';
import { useTranslations } from 'next-intl';

import { toast } from 'react-hot-toast';

interface ActorFormProps {
  isNew?: boolean;
  actorId?: string;
}

export default function ActorForm({ isNew, actorId }: ActorFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    try {
      const data = {
        name: formData.get('name') as string,
        industry: (formData.get('industry') as string) || undefined,
        email: (formData.get('email') as string) || undefined,
      };

      if (isNew) {
        await actorsControllerCreate(data);
      } else {
        if (!actorId) throw new Error('Missing actorId');
        await actorsControllerUpdate(actorId, data);
      }

      toast.success(isNew ? 'Actor created' : 'Actor updated');
      router.push('/crm/actors');
    } catch (err) {
      toast.error('An error occurred');
      reportError(err, 'ActorForm');
    } finally {
      setLoading(false);
    }
  }

  const title = isNew ? 'Create Actor' : 'Edit Actor';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input className="border rounded px-3 py-2 w-full" name="name" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Industry</label>
          <input className="border rounded px-3 py-2 w-full" name="industry" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input className="border rounded px-3 py-2 w-full" name="email" type="email" />
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
