import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';
import { ContactCard } from '@/components/shared/ContactCard';
import { ContactSlideOver } from '@/components/shared/ContactSlideOver';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Temporary type fallback
export type ContactLinkWithDetails = any;

interface ContactListTabProps {
  entityId: string;
  entityType: 'actor' | 'customer' | 'supplier' | 'opportunity';
  contacts: ContactLinkWithDetails[];
  onContactAdded: () => void;
}

export function ContactListTab({ entityId, entityType, contacts, onContactAdded }: ContactListTabProps) {
  const tCommon = useTranslations('common');
  const [isAdding, setIsAdding] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Temporary type fallback
  const [editingContact, setEditingContact] = useState<any | null>(null);

  const handleUnlink = async (contactId: string, contactName: string) => {
    if (!window.confirm(`Are you sure you want to unlink ${contactName}?`)) return;
    try {
      if (entityType === 'opportunity') {
        await api.opportunitiesControllerDeleteContact(entityId, contactId);
      } else {
        // actor, customer, or supplier
        let actorId = entityId;
        if (entityType === 'customer') {
          const cust = await api.customersControllerFindOne(entityId);
          actorId = cust.data.actorId;
        } else if (entityType === 'supplier') {
          const supp = await api.suppliersControllerFindOne(entityId);
          actorId = supp.data.actorId;
        }
        await api.actorsControllerRemoveContact(actorId, contactId);
      }
      toast.success('Contact unlinked');
      onContactAdded();
    } catch (e) {
      toast.error('Failed to unlink contact');
      reportError(e, 'ContactListTab - handleUnlink');
    }
  };

  const handleEdit = (link: ContactLinkWithDetails) => {
    const data = {
      ...link.contact,
      primaryFor: link.primaryFor || [],
      projectRoles: link.roles || [],
    };
    setEditingContact(data);
    setIsAdding(true);
  };

  const handleAdd = () => {
    setEditingContact(null);
    setIsAdding(true);
  };

  const sortedContacts = React.useMemo(() => {
    if (!contacts) return [];
    return [...contacts].sort((a, b) => {
      const lastA = (a.contact?.lastName || '').toLowerCase();
      const lastB = (b.contact?.lastName || '').toLowerCase();
      if (lastA < lastB) return -1;
      if (lastA > lastB) return 1;
      
      const firstA = (a.contact?.firstName || '').toLowerCase();
      const firstB = (b.contact?.firstName || '').toLowerCase();
      return firstA.localeCompare(firstB);
    });
  }, [contacts]);

  return (
    <div className="flex flex-col gap-3">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h3 className="section-heading m-0">
            <span className="material-symbols-outlined">group</span>
            Contacts
          </h3>
          <Button variant="primary" size="sm" onClick={handleAdd}>
            {tCommon('buttons.addContact')}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedContacts.length > 0 ? sortedContacts.map((link) => {
            const contact = link.contact;
            if (!contact) return null;
            const rawRoles = entityType === 'opportunity' ? (link.roles || []) : (link.primaryFor || []);
            const roles = rawRoles.map((r: unknown) => typeof r === 'object' && r !== null && 'value' in r ? String((r as Record<string, unknown>).value) : String(r));
            return (
              <ContactCard
                key={contact.contactId || link.id || Math.random().toString()}
                contact={contact}
                primaryRoles={roles}
                onEdit={() => handleEdit(link)}
                onDelete={() => handleUnlink(contact.contactId, `${contact.firstName} ${contact.lastName}`)}
                deleteTitle="Unlink Contact"
              />
            );
          }) : (
            <div className="text-gray-500 text-sm py-4">No contacts found.</div>
          )}
        </div>
      </div>

      <ContactSlideOver
        isOpen={isAdding}
        onClose={() => setIsAdding(false)}
        entityId={entityId}
        entityType={entityType}
        contactId={editingContact?.contactId}
        existingData={editingContact || undefined}
        onSaved={onContactAdded}
      />
    </div>
  );
}
