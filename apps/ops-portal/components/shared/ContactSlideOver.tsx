import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Button } from '@/components/shared/Button';
import ContactSelect, { Contact } from '@/components/shared/ContactSelect';
import { useSettings } from '@/components/SettingsProvider';

const parseInitialPhone = (val: string) => {
  if (!val) return '';
  if (val.startsWith('+')) return val;
  const digits = val.replace(/\D/g, '');
  if (digits.length > 0) return '+' + digits;
  return '';
};

interface ContactSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  entityId?: string;
  entityType?: 'customer' | 'supplier' | 'actor' | 'project';
  contactId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic wrapper for API usage @typescript-eslint/no-explicit-any
  existingData?: Partial<any>;
  defaultCountry?: string;
  onSaved: () => void;
  onLinkExisting?: () => void;
}

export const ContactSlideOver: React.FC<ContactSlideOverProps> = ({
  isOpen,
  onClose,
  entityId,
  entityType,
  contactId,
  existingData,
  defaultCountry,
  onSaved,
}) => {
  const { app: appSettings } = useSettings();
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  const [dto, setDto] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    email: '',
    phone: '',
    mobile: '',
    primaryFor: [] as string[],
    projectRoles: [] as string[],
  });

  useEffect(() => {
    if (isOpen) {
      if (existingData) {
        setDto({
          firstName: existingData.firstName || '',
          lastName: existingData.lastName || '',
          jobTitle: existingData.jobTitle || '',
          email: existingData.email || '',
          phone: existingData.phone || '',
          mobile: existingData.mobile || '',
          primaryFor: existingData.primaryFor || [],
          projectRoles: existingData.projectRoles || existingData.roles || [],
        });
      } else {
        setDto({
          firstName: '',
          lastName: '',
          jobTitle: '',
          email: '',
          phone: '',
          mobile: '',
          primaryFor: [],
          projectRoles: [],
        });
        setSelectedContact(null);
      }
    }
  }, [isOpen, existingData]);

  // Handle auto-fill when an existing contact is selected
  const handleSelectContact = async (contact: Contact | null) => {
    setSelectedContact(contact);
    if (!contact) {
      // Clear data if they clear the select
      setDto({
        firstName: '',
        lastName: '',
        jobTitle: '',
        email: '',
        phone: '',
        mobile: '',
        primaryFor: dto.primaryFor,
        projectRoles: dto.projectRoles,
      });
      return;
    }
    
    // Auto-fill from ContactSelect data
    setDto({
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      jobTitle: contact.jobTitle || '',
      email: contact.email || '',
      phone: (contact as unknown as { phone?: string }).phone || '',
      mobile: (contact as unknown as { mobile?: string }).mobile || '',
      primaryFor: dto.primaryFor,
      projectRoles: dto.projectRoles,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dto.firstName) {
      toast.error(t('contactManagement.errors.firstNameRequired'));
      return;
    }
    if (!dto.lastName) {
      toast.error(t('contactManagement.errors.lastNameRequired'));
      return;
    }

    setSaving(true);
    try {
      let finalContactId = contactId || selectedContact?.contactId;

      if (finalContactId) {
        // Ensure finalContactId is purely a trimmed string to satisfy class-validator @IsUUID
        finalContactId = String(finalContactId).trim();
        
        // Update the global record identity
        await api.contactsControllerUpdate(finalContactId, {
          firstName: dto.firstName,
          lastName: dto.lastName,
          jobTitle: dto.jobTitle || undefined,
          email: dto.email || undefined,
          phone: dto.phone || undefined,
          mobile: dto.mobile || undefined,
        });

        // Link or update link metadata
        if (entityId && entityType) {
          if (entityType === 'project') {
            if (!contactId && selectedContact) {
              // Linking for the first time
              await api.projectsControllerAddContact(entityId, { 
                contactId: finalContactId, 
                roles: dto.projectRoles.length > 0 ? dto.projectRoles : undefined 
              });
            } else if (contactId) {
              // Updating existing link
              await api.projectsControllerUpdateContact(entityId, finalContactId, { 
                roles: dto.projectRoles.length > 0 ? dto.projectRoles : undefined 
              });
            }
          } else {
            // customer | supplier | actor
            // Note: Customers and suppliers use actorsController endpoints underneath for links
            let actorId = entityId;
            if (entityType === 'customer') {
              const cust = await api.customersControllerFindOne(entityId);
              actorId = cust.data.actorId;
            } else if (entityType === 'supplier') {
              const supp = await api.suppliersControllerFindOne(entityId);
              actorId = supp.data.actorId;
            }
            
            if (actorId) {
              if (!contactId && selectedContact) {
                // Linking for the first time
                await api.actorsControllerAddContact(actorId, { contactId: finalContactId, primaryFor: dto.primaryFor });
              } else if (contactId) {
                // Updating existing link
                await api.actorsControllerUpdateContact(actorId, finalContactId, { primaryFor: dto.primaryFor });
              }
            }
          }
        }

        toast.success(t('contactManagement.contactUpdated'));
      } else {
        // Brand new contact created and linked automatically via backend
        await api.contactsControllerCreate({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required because SDK typing is too strict here
          entityType: (entityType as any) || undefined,
          entityId: entityId || undefined,
          firstName: dto.firstName,
          lastName: dto.lastName,
          jobTitle: dto.jobTitle || undefined,
          email: dto.email || undefined,
          phone: dto.phone || undefined,
          mobile: dto.mobile || undefined,
          primaryFor: dto.primaryFor.length > 0 ? dto.primaryFor : undefined,
          projectRoles: dto.projectRoles.length > 0 ? dto.projectRoles : undefined,
        });
        toast.success(t('contactManagement.contactAdded'));
      }
      onSaved();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={contactId ? t('contactManagement.editContact') : t('contactManagement.addContact')}
      width="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            form="contact-form"
            variant="primary"
            className="bg-[var(--accent)] hover:opacity-90 border-none text-white"
            disabled={saving}
          >
            {saving ? (
              <><span className="loading loading-spinner loading-sm mr-2" />{tCommon('saving')}</>
            ) : (
              tCommon('save')
            )}
          </Button>
        </div>
      }
    >
      <form id="contact-form" onSubmit={handleSave} className="flex flex-col gap-5 h-full pb-6">
        
        {!contactId && (
          <div className="bg-gray-50 -mx-6 px-6 py-4 border-b border-gray-100 mb-2">
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              Search Existing Contact
            </label>
            <ContactSelect
              value={selectedContact?.contactId || null}
              onChange={handleSelectContact}
              placeholder="Type to search..."
              disabled={saving}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('contactManagement.firstName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input w-full"
              value={dto.firstName}
              onChange={(e) => setDto({ ...dto, firstName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('contactManagement.lastName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input w-full"
              value={dto.lastName}
              onChange={(e) => setDto({ ...dto, lastName: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('contactManagement.jobTitle')}
          </label>
          <input
            type="text"
            className="input w-full"
            value={dto.jobTitle}
            onChange={(e) => setDto({ ...dto, jobTitle: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('contactManagement.email')}
          </label>
          <input
            type="email"
            className="input w-full"
            value={dto.email}
            onChange={(e) => setDto({ ...dto, email: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('contactManagement.phone')}
            </label>
            <PhoneInput
              international
              defaultCountry={defaultCountry as Country}
              className="input w-full flex items-center px-2 border border-[var(--border)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]"
              value={parseInitialPhone(dto.phone)}
              onChange={(value) => setDto({ ...dto, phone: value || '' })}
            />
            {dto.phone && !isValidPhoneNumber(dto.phone) && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1.5 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {t('contactManagement.nonStandardPhone')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('contactManagement.mobile')}
            </label>
            <PhoneInput
              international
              defaultCountry={defaultCountry as Country}
              className="input w-full flex items-center px-2 border border-[var(--border)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]"
              value={parseInitialPhone(dto.mobile)}
              onChange={(value) => setDto({ ...dto, mobile: value || '' })}
            />
            {dto.mobile && !isValidPhoneNumber(dto.mobile) && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1.5 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {t('contactManagement.nonStandardPhone')}
              </p>
            )}
          </div>
        </div>

        {/* Link Metadata Fields */}
        {entityType && entityType !== 'project' && (
          <div className="mt-2 pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium mb-3 text-[var(--text-muted)]">
              Actor Roles
            </label>
            <div className="flex flex-col gap-3">
              {[...(appSettings?.actorContactRoles || [])].sort((a, b) => Number(a.order) - Number(b.order)).map((r) => (
                <label key={r.value} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={dto.primaryFor.includes(r.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDto({ ...dto, primaryFor: [...dto.primaryFor, r.value] });
                      } else {
                        setDto({ ...dto, primaryFor: dto.primaryFor.filter(x => x !== r.value) });
                      }
                    }}
                  />
                  <span className="text-sm capitalize group-hover:text-gray-900 transition-colors">{r.value}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {entityType === 'project' && (
          <div className="mt-2 pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium mb-3 text-[var(--text-muted)]">
              Project Roles
            </label>
            <div className="flex flex-col gap-3">
              {[...(appSettings?.projectContactRoles || [])].sort((a, b) => Number(a.order) - Number(b.order)).map((r) => (
                <label key={r.value} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={dto.projectRoles.includes(r.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDto({ ...dto, projectRoles: [...dto.projectRoles, r.value] });
                      } else {
                        setDto({ ...dto, projectRoles: dto.projectRoles.filter(x => x !== r.value) });
                      }
                    }}
                  />
                  <span className="text-sm capitalize group-hover:text-gray-900 transition-colors">{r.value}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </form>
    </SlideOver>
  );
};
