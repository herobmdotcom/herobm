"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-hot-toast";
import * as api from "@herobm/sdk";
import { getErrorMessage } from "@herobm/shared";
import { Button } from "@/components/shared/Button";
import { ContactCard } from "@/components/shared/ContactCard";
import { ContactSlideOver } from "@/components/shared/ContactSlideOver";

interface SupplierContactsTabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supplier DTO lacks strict contacts field in SDK types
  supplier: any;
  loadSupplier: () => void;
}

export function SupplierContactsTab({ supplier, loadSupplier }: SupplierContactsTabProps) {
  const t = useTranslations();

  const [isContactSlideOverOpen, setIsContactSlideOverOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<api.ContactResponseDto | null>(null);

  if (!supplier) return null;

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
        loadSupplier();
      } catch (err: unknown) {
        toast.error(getErrorMessage(err));
      }
    }
  };

  const contactsList = (supplier.contacts as api.ContactResponseDto[]) || [];

  return (
    <div className="flex flex-col gap-3">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h3 className="section-heading m-0">
            <span className="material-symbols-outlined">group</span>
            {t("customers.contacts")}
          </h3>
          <Button variant="primary" size="sm" onClick={handleAddContactClick}>
            {t("customers.contactManagement.addContact")}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contactsList.length > 0 ? (
            [...contactsList]
              .sort((a, b) => ((b.primaryFor?.includes("purchasing") ? 1 : 0) - (a.primaryFor?.includes("purchasing") ? 1 : 0)) || (a.firstName || "").localeCompare(b.firstName || ""))
              .map((contact) => (
                <ContactCard
                  key={contact.contactId}
                  contact={contact}
                  primaryRoles={contact.primaryFor || []}
                  onEdit={() => handleEditContactClick(contact)}
                  onDelete={() => handleDeleteContactClick(contact.contactId)}
                  deleteTitle={t("customers.contactManagement.deleteContact")}
                />
              ))
          ) : (
            <div className="text-gray-500 text-sm py-4">{t("portal.noContactsFound")}</div>
          )}
        </div>
      </div>

      <ContactSlideOver
        isOpen={isContactSlideOverOpen}
        onClose={() => setIsContactSlideOverOpen(false)}
        entityId={supplier.vendorId}
        entityType="supplier"
        contactId={editingContact?.contactId}
        existingData={editingContact || undefined}
        defaultCountry={supplier.address1Country || undefined}
        onSaved={() => {
          setIsContactSlideOverOpen(false);
          loadSupplier();
        }}
      />
    </div>
  );
}
