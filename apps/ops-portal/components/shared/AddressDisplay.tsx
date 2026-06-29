import React from 'react';

export interface AddressDisplayProps {
  companyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  recipientName?: string;
}

export function getCountryName(countryCode?: string): string {
  if (!countryCode) return '';
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

export const AddressDisplay: React.FC<AddressDisplayProps> = ({
  companyName,
  addressLine1,
  addressLine2,
  city,
  stateOrProvince,
  postalCode,
  country,
  phone,
  recipientName,
}) => {
  if (!addressLine1 && !city && !country) return null;

  return (
    <div className="mt-1 text-sm">
      {(recipientName || phone) && (
        <div>
          Attn: {[recipientName, phone ? `(${phone})` : null].filter(Boolean).join(' ')}
        </div>
      )}
      {companyName && (
        <div>
          {companyName}
        </div>
      )}
      {addressLine1 && <div>{addressLine1}</div>}
      {addressLine2 && <div>{addressLine2}</div>}
      <div>
        {[city, stateOrProvince, postalCode].filter(Boolean).join(', ')}
      </div>
      {country && <div>{getCountryName(country)}</div>}
    </div>
  );
};

export default AddressDisplay;
