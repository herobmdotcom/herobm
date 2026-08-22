import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { Button } from './Button';
import { getErrorMessage, COUNTRIES } from '@herobm/shared';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const parseInitialPhone = (val: string) => {
  if (!val) return '';
  if (val.startsWith('+')) return val;
  const digits = val.replace(/\D/g, '');
  if (digits.length > 0) return '+' + digits;
  return '';
};

interface DeliveryAddressSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string;
  addressId?: string;
  existingData?: Partial<api.CreateDeliveryAddressDto & { id?: string }>;
  allowUnsaved?: boolean;
  defaultCountry?: string;
  onSaved: (address: api.DeliveryAddressResponseDto, saved: boolean) => void;
}

const DeliveryAddressSlideOver: React.FC<DeliveryAddressSlideOverProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  addressId,
  existingData,
  allowUnsaved = false,
  defaultCountry,
  onSaved,
}) => {
  const tCommon = useTranslations('common');
  const t = useTranslations('deliveryAddress');
  const [saving, setSaving] = useState(false);
  const [saveToCustomer, setSaveToCustomer] = useState(true);
  const [dto, setDto] = useState({
    addressName: '',
    companyName: '',
    recipientName: '',
    recipientPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateOrProvince: '',
    postalCode: '',
    country: '',
    isPrimary: false,
  });

  useEffect(() => {
    if (isOpen) {
      setSaveToCustomer(true);
      if (existingData) {
        setDto({
          addressName: existingData.addressName || '',
          companyName: existingData.companyName !== undefined ? existingData.companyName : (!addressId ? (customerName || '') : ''),
          recipientName: existingData.recipientName || '',
          recipientPhone: existingData.recipientPhone || '',
          addressLine1: existingData.addressLine1?.replace(/[\r\n]+/g, ' ') || '',
          addressLine2: existingData.addressLine2 || '',
          city: existingData.city || '',
          stateOrProvince: existingData.stateOrProvince || '',
          postalCode: existingData.postalCode || '',
          country: existingData.country || defaultCountry || '',
          isPrimary: existingData.isPrimary || false,
        });
      } else {
        setDto({
          addressName: '',
          companyName: customerName || '',
          recipientName: '',
          recipientPhone: '',
          addressLine1: '',
          addressLine2: '',
          city: '',
          stateOrProvince: '',
          postalCode: '',
          country: defaultCountry || '',
          isPrimary: false,
        });
      }
    }
  }, [isOpen, existingData]);

  const handleChange = (field: keyof typeof dto, value: string | boolean) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!dto.addressLine1 || !dto.country) {
      toast.error(t('requiredError'));
      return;
    }

    if (allowUnsaved && !saveToCustomer) {
      onSaved(dto as api.DeliveryAddressResponseDto, false);
      onClose();
      return;
    }

    setSaving(true);
    try {
      if (addressId) {
        const updatePayload: api.UpdateDeliveryAddressDto = {
          addressName: dto.addressName,
          companyName: dto.companyName,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          stateOrProvince: dto.stateOrProvince,
          postalCode: dto.postalCode,
          country: dto.country,
          isPrimary: dto.isPrimary,
        };
        await api.deliveryAddressesControllerUpdate(addressId, updatePayload);
        toast.success(t('updatedSuccess'));
        onSaved({ ...dto, deliveryAddressId: addressId } as api.DeliveryAddressResponseDto, true);
      } else {
        const createPayload: api.CreateDeliveryAddressDto = {
          customerId,
          addressName: dto.addressName,
          companyName: dto.companyName,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          stateOrProvince: dto.stateOrProvince,
          postalCode: dto.postalCode,
          country: dto.country,
          isPrimary: dto.isPrimary,
        };
        const res = await api.deliveryAddressesControllerCreate(createPayload);
        toast.success(t('createdSuccess'));
        onSaved({ ...dto, deliveryAddressId: res.data.deliveryAddressId } as api.DeliveryAddressResponseDto, true);
      }
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={addressId ? t('editAddress') : t('addAddress')}
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div>
            {allowUnsaved && !addressId && (
              <label className="flex items-center space-x-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToCustomer}
                  onChange={(e) => setSaveToCustomer(e.target.checked)}
                  disabled={saving}
                  className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span>{t('saveToCustomerRecord')}</span>
              </label>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
            >
              {tCommon('save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('addressName')}
          </label>
          <input
            type="text"
            className="input"
            value={dto.addressName || ''}
            onChange={(e) => handleChange('addressName', e.target.value)}
            placeholder={t('addressNamePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('companyName')}
          </label>
          <input
            type="text"
            className="input"
            value={dto.companyName || ''}
            onChange={(e) => handleChange('companyName', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('contactPerson')}
            </label>
            <input
              type="text"
              className="input"
              value={dto.recipientName || ''}
              onChange={(e) => handleChange('recipientName', e.target.value)}
              placeholder={t('contactPersonPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('contactPhone')}
            </label>
            <PhoneInput
              international
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
              defaultCountry={defaultCountry as any}
              className="input w-full flex items-center px-2 border border-[var(--border)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]"
              value={parseInitialPhone(dto.recipientPhone)}
              onChange={(value) => handleChange('recipientPhone', value || '')}
              placeholder={t('contactPhonePlaceholder')}
            />
            {dto.recipientPhone && !dto.recipientPhone.startsWith('+') && (
              <p className="text-xs text-orange-500 mt-1">{tCommon('rawPhone', { phone: dto.recipientPhone })}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('addressLine1')}
          </label>
          <input
            type="text"
            className="input"
            value={dto.addressLine1 || ''}
            onChange={(e) => handleChange('addressLine1', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('addressLine2')}
          </label>
          <input
            type="text"
            className="input"
            value={dto.addressLine2 || ''}
            onChange={(e) => handleChange('addressLine2', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('city')}
            </label>
            <input
              type="text"
              className="input"
              value={dto.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('stateOrProvince')}
            </label>
            <input
              type="text"
              className="input"
              value={dto.stateOrProvince || ''}
              onChange={(e) => handleChange('stateOrProvince', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('postalCode')}
            </label>
            <input
              type="text"
              className="input"
              value={dto.postalCode || ''}
              onChange={(e) => handleChange('postalCode', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('country')}
            </label>
            <select
              className="input"
              value={dto.country}
              onChange={(e) => handleChange('country', e.target.value)}
            >
              <option value="" disabled>
                {t('selectCountry')}
              </option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            id="isPrimaryDeliveryAddress"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
            checked={dto.isPrimary}
            onChange={(e) => handleChange('isPrimary', e.target.checked)}
          />
          <label
            htmlFor="isPrimaryDeliveryAddress"
            className="text-sm text-gray-700 cursor-pointer"
          >
            {t('setAsPrimary')}
          </label>
        </div>
      </div>
    </SlideOver>
  );
};

export default DeliveryAddressSlideOver;
