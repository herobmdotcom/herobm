/* eslint-disable i18next/no-literal-string */
import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage, COUNTRIES } from '@modbm/shared';

interface DeliveryAddressSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  addressId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingData?: Record<string, any>;
  onSaved: () => void;
}

export const DeliveryAddressSlideOver: React.FC<DeliveryAddressSlideOverProps> = ({
  isOpen,
  onClose,
  customerId,
  addressId,
  existingData,
  onSaved,
}) => {
  const tCommon = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [dto, setDto] = useState({
    addressName: '',
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
      if (existingData) {
        setDto({
          addressName: existingData.addressName || '',
          addressLine1: existingData.addressLine1 || '',
          addressLine2: existingData.addressLine2 || '',
          city: existingData.city || '',
          stateOrProvince: existingData.stateOrProvince || '',
          postalCode: existingData.postalCode || '',
          country: existingData.country || '',
          isPrimary: existingData.isPrimary || false,
        });
      } else {
        setDto({
          addressName: '',
          addressLine1: '',
          addressLine2: '',
          city: '',
          stateOrProvince: '',
          postalCode: '',
          country: '',
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
      toast.error('Address Line 1 and Country are required');
      return;
    }

    setSaving(true);
    try {
      if (addressId) {
        await api.deliveryAddressesControllerUpdate(addressId, {
          ...dto,
        });
        toast.success('Address updated');
      } else {
        await api.deliveryAddressesControllerCreate({
          ...dto,
          customerId,
        });
        toast.success('Address created');
      }
      onSaved();
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
      title={addressId ? 'Edit Delivery Address' : 'Add Delivery Address'}
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button
            className="btn btn-outline"
            onClick={onClose}
            disabled={saving}
          >
            {tCommon('cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-sm">
                progress_activity
              </span>
            ) : null}
            {tCommon('save')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Name
          </label>
          <input
            type="text"
            className="input"
            value={dto.addressName}
            onChange={(e) => handleChange('addressName', e.target.value)}
            placeholder="e.g. Headquarters"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 1 *
          </label>
          <input
            type="text"
            className="input"
            value={dto.addressLine1}
            onChange={(e) => handleChange('addressLine1', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 2
          </label>
          <input
            type="text"
            className="input"
            value={dto.addressLine2}
            onChange={(e) => handleChange('addressLine2', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              className="input"
              value={dto.city}
              onChange={(e) => handleChange('city', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State / Province
            </label>
            <input
              type="text"
              className="input"
              value={dto.stateOrProvince}
              onChange={(e) => handleChange('stateOrProvince', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Postal Code
            </label>
            <input
              type="text"
              className="input"
              value={dto.postalCode}
              onChange={(e) => handleChange('postalCode', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country *
            </label>
            <select
              className="input"
              value={dto.country}
              onChange={(e) => handleChange('country', e.target.value)}
            >
              <option value="" disabled>
                Select Country
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
            Set as primary delivery address
          </label>
        </div>
      </div>
    </SlideOver>
  );
};
