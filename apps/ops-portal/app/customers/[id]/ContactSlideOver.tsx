import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import PhoneInput from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

// PhoneInput will throw if value is truthy but doesn't start with +
// This helper tries to salvage digits, or returns empty string to prevent crashes.
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
  entityId: string;
  entityType: 'customer';
  contactId?: string;
  existingData?: Partial<api.ContactResponseDto>;
  defaultCountry?: string;
  onSaved: () => void;
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
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [dto, setDto] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    email: '',
    phone: '',
    mobile: '',
    isPrimary: false,
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
          isPrimary: existingData.isPrimary || false,
        });
      } else {
        setDto({
          firstName: '',
          lastName: '',
          jobTitle: '',
          email: '',
          phone: '',
          mobile: '',
          isPrimary: false,
        });
      }
    }
  }, [isOpen, existingData]);

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
      if (contactId) {
        await api.contactsControllerUpdate(contactId, {
          firstName: dto.firstName,
          lastName: dto.lastName,
          jobTitle: dto.jobTitle || undefined,
          email: dto.email || undefined,
          phone: dto.phone || undefined,
          mobile: dto.mobile || undefined,
          isPrimary: dto.isPrimary,
        });
        toast.success(t('contactManagement.contactUpdated'));
      } else {
        await api.contactsControllerCreate({
          entityType,
          entityId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          jobTitle: dto.jobTitle || undefined,
          email: dto.email || undefined,
          phone: dto.phone || undefined,
          mobile: dto.mobile || undefined,
          isPrimary: dto.isPrimary,
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
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            form="contact-form"
            className="btn btn-primary bg-[var(--accent)] hover:opacity-90 border-none text-white"
            disabled={saving}
          >
            {saving ? (
              <><span className="loading loading-spinner loading-sm mr-2" />{tCommon('saving')}</>
            ) : (
              tCommon('save')
            )}
          </button>
        </div>
      }
    >
      <form id="contact-form" onSubmit={handleSave} className="flex flex-col gap-5 h-full">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('contactManagement.phone')}
            </label>
            <PhoneInput
              international
              defaultCountry={defaultCountry as Country}
              className="input w-full flex items-center px-2 border border-[var(--border)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]"
              value={parseInitialPhone(dto.phone)}
              onChange={(value) => setDto({ ...dto, phone: value || '' })}
            />
            {dto.phone && !dto.phone.startsWith('+') && (
              // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon).
              <p className="text-xs text-orange-500 mt-1">{'Raw: '}{dto.phone}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('contactManagement.mobile')}
            </label>
            <PhoneInput
              international
              defaultCountry={defaultCountry as Country}
              className="input w-full flex items-center px-2 border border-[var(--border)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]"
              value={parseInitialPhone(dto.mobile)}
              onChange={(value) => setDto({ ...dto, mobile: value || '' })}
            />
            {dto.mobile && !dto.mobile.startsWith('+') && (
              // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon).
              <p className="text-xs text-orange-500 mt-1">{'Raw: '}{dto.mobile}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            className="checkbox"
            checked={dto.isPrimary}
            onChange={(e) => setDto({ ...dto, isPrimary: e.target.checked })}
            id="isPrimary"
          />
          <label htmlFor="isPrimary" className="text-sm font-medium cursor-pointer">
            {t('contactManagement.isPrimary')}
          </label>
        </div>
      </form>
    </SlideOver>
  );
};
