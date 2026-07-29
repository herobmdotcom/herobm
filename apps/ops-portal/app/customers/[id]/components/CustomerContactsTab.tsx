"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-hot-toast";
import * as api from "@herobm/sdk";
import { getErrorMessage } from "@herobm/shared";
import { Button } from '@/components/shared/Button';
import { ContactCard } from "@/components/shared/ContactCard";
import { ContactSlideOver } from "@/components/shared/ContactSlideOver";

interface CustomerContactsTabProps {
  customer: any;
  loadAccount: () => void;
}

export function CustomerContactsTab({ customer, loadAccount }: CustomerContactsTabProps) {
  const t = useTranslations();
  const [isContactSlideOverOpen, setIsContactSlideOverOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<api.ContactResponseDto | null>(null);

  const handleAddContactClick = () => {
    setEditingContact(null);
    setIsContactSlideOverOpen(true);
  };

  const handleEditContactClick = (contact: api.ContactResponseDto) => {
    setEditingContact(contact);
    setIsContactSlideOverOpen(true);
  };

  const handleDeleteContactClick = async (contactId: string) => {
    if (window.confirm(t("customers.contactManagement.confirmDeleteContact"))) {
      try {
        await api.contactsControllerRemove(contactId);
        toast.success(t("customers.contactManagement.contactDeleted"));
        loadAccount();
      } catch (err: unknown) {
        toast.error(getErrorMessage(err));
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h3 className="section-heading m-0">
            { }
            { }
            <span className="material-symbols-outlined">group</span>
            {t("customers.contacts")}
          </h3>
          <Button variant="primary" size="sm" onClick={handleAddContactClick}>
            {t("customers.contactManagement.addContact")}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(customer.contacts as unknown as api.ContactResponseDto[]) && (customer.contacts as unknown as api.ContactResponseDto[]).length > 0 ? [...(customer.contacts as unknown as api.ContactResponseDto[])].sort((a, b) => ((b.primaryFor?.includes('purchasing') ? 1 : 0) - (a.primaryFor?.includes('purchasing') ? 1 : 0)) || (a.firstName || '').localeCompare(b.firstName || '')).map((contact) => (
            <ContactCard
              key={contact.contactId}
              contact={contact as unknown as api.ContactResponseDto}
              primaryRoles={contact.primaryFor || []}
              onEdit={() => handleEditContactClick(contact)}
              onDelete={() => handleDeleteContactClick(contact.contactId)}
              deleteTitle={t("customers.contactManagement.deleteContact")}
            />
          )) : (
            <>
              { }
              <div className="text-gray-500 text-sm py-4">{t("portal.noContactsFound")}</div>
            </>
          )}
        </div>
      </div>
      
      <ContactSlideOver
        isOpen={isContactSlideOverOpen}
        onClose={() => setIsContactSlideOverOpen(false)}
        entityId={customer.customerId}
        entityType="customer"
        contactId={editingContact?.contactId}
        existingData={editingContact || undefined}
        defaultCountry={customer.billingAddressCountry || undefined}
        onSaved={() => {
          setIsContactSlideOverOpen(false);
          loadAccount();
        }}
      />
    </div>
  );
}
