import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SchemaBuilder, titleToInternalKey } from '../SchemaBuilder';

const translations: Record<string, string> = {
  'schemaBuilder.addField': 'Add Field',
  'schemaBuilder.cancel': 'Cancel',
  'schemaBuilder.dataType': 'Data Type',
  'schemaBuilder.dropdownOptions': 'Dropdown Options',
  'schemaBuilder.editField': 'Edit Field',
  'schemaBuilder.editFieldTitle': 'Edit: {title}',
  'schemaBuilder.fieldTitle': 'Field Title (UI Label)',
  'schemaBuilder.internalKey': 'Internal Key (JSON property)',
  'schemaBuilder.newField': 'New Field',
  'schemaBuilder.noFields': 'No extra fields defined yet.',
  'schemaBuilder.removeField': 'Remove Field',
  'schemaBuilder.requiredField': 'Required Field',
  'schemaBuilder.save': 'Save',
  'schemaBuilder.saveField': 'Save Field',
  'schemaBuilder.types.boolean': 'Toggle (Boolean)',
  'schemaBuilder.types.date': 'Date Picker',
  'schemaBuilder.types.enum': 'Dropdown (Single Choice)',
  'schemaBuilder.types.number': 'Number',
  'schemaBuilder.types.string': 'Short Text',
  'schemaBuilder.types.textarea': 'Long Text (Multiline)',
  'schemaBuilder.untitledField': 'Untitled Field',
};

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const fullKey = ns ? `${ns}.${key}` : key;
    let text = translations[fullKey] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  },
}));

describe('titleToInternalKey', () => {
  it('converts standard multi-word titles into camelCase', () => {
    expect(titleToInternalKey('Field Title')).toBe('fieldTitle');
    expect(titleToInternalKey('BSB Number')).toBe('bsbNumber');
    expect(titleToInternalKey('Customer Loyalty Tier')).toBe('customerLoyaltyTier');
  });

  it('converts titles with special characters, symbols, and punctuation', () => {
    expect(titleToInternalKey('Tax ID (VAT / GST)')).toBe('taxIdVatGst');
    expect(titleToInternalKey("Customer's Notes & Comments")).toBe('customersNotesComments');
    expect(titleToInternalKey('Price ($ AUD)')).toBe('priceAud');
    expect(titleToInternalKey('Is VIP Member?')).toBe('isVipMember');
  });

  it('handles snake_case, kebab-case, and mixed delimiters', () => {
    expect(titleToInternalKey('order_tracking_number')).toBe('orderTrackingNumber');
    expect(titleToInternalKey('custom-field-name')).toBe('customFieldName');
    expect(titleToInternalKey('__internal__code__')).toBe('internalCode');
  });

  it('handles camelCase and PascalCase inputs gracefully', () => {
    expect(titleToInternalKey('deliveryDate')).toBe('deliveryDate');
    expect(titleToInternalKey('DeliveryDate')).toBe('deliveryDate');
    expect(titleToInternalKey('myCustomField')).toBe('myCustomField');
  });

  it('handles titles with numbers', () => {
    expect(titleToInternalKey('Address Line 2')).toBe('addressLine2');
    expect(titleToInternalKey('123 Code')).toBe('123Code');
  });

  it('returns empty string for empty, undefined, or whitespace-only inputs', () => {
    expect(titleToInternalKey('')).toBe('');
    expect(titleToInternalKey('   ')).toBe('');
    expect(titleToInternalKey('!@#$%^&*()')).toBe('');
  });
});

describe('SchemaBuilder Component', () => {
  it('renders empty state when no fields exist', () => {
    const handleChange = jest.fn();
    render(<SchemaBuilder value={{ type: 'object', properties: {} }} onChange={handleChange} />);
    expect(screen.getByText('No extra fields defined yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Field' })).toBeInTheDocument();
  });

  it('automatically fills Internal Key with a JSON-friendly key as user types Field Title', () => {
    const handleChange = jest.fn();
    render(<SchemaBuilder value={{ type: 'object', properties: {} }} onChange={handleChange} />);

    // Click "Add Field"
    fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));

    const titleInput = screen.getByPlaceholderText('e.g. BSB Number') as HTMLInputElement;
    const keyInput = screen.getByPlaceholderText('e.g. bsbNumber') as HTMLInputElement;

    expect(titleInput.value).toBe('');
    expect(keyInput.value).toBe('');

    // User types "Delivery Instructions"
    fireEvent.change(titleInput, { target: { value: 'Delivery Instructions' } });
    expect(titleInput.value).toBe('Delivery Instructions');
    expect(keyInput.value).toBe('deliveryInstructions');

    // User updates title with special characters
    fireEvent.change(titleInput, { target: { value: 'Delivery Notes (Special / Urgent)' } });
    expect(titleInput.value).toBe('Delivery Notes (Special / Urgent)');
    expect(keyInput.value).toBe('deliveryNotesSpecialUrgent');
  });

  it('allows user to manually override the Internal Key if needed', () => {
    const handleChange = jest.fn();
    render(<SchemaBuilder value={{ type: 'object', properties: {} }} onChange={handleChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));

    const titleInput = screen.getByPlaceholderText('e.g. BSB Number') as HTMLInputElement;
    const keyInput = screen.getByPlaceholderText('e.g. bsbNumber') as HTMLInputElement;

    // User types title
    fireEvent.change(titleInput, { target: { value: 'Custom Code' } });
    expect(keyInput.value).toBe('customCode');

    // User manually customizes key
    fireEvent.change(keyInput, { target: { value: 'my_custom_code' } });
    expect(keyInput.value).toBe('my_custom_code');
  });

  it('automatically updates Internal Key when editing an existing field title', () => {
    const handleChange = jest.fn();
    const initialSchema = {
      type: 'object',
      properties: {
        loyaltyTier: {
          title: 'Loyalty Tier',
          type: 'string',
        },
      },
      required: ['loyaltyTier'],
    };

    render(<SchemaBuilder value={initialSchema} onChange={handleChange} />);

    // Click edit button for the existing field
    const editBtn = screen.getByTitle('Edit Field');
    fireEvent.click(editBtn);

    const titleInput = screen.getByPlaceholderText('e.g. BSB Number') as HTMLInputElement;
    const keyInput = screen.getByPlaceholderText('e.g. bsbNumber') as HTMLInputElement;

    expect(titleInput.value).toBe('Loyalty Tier');
    expect(keyInput.value).toBe('loyaltyTier');

    // User changes field title to "VIP Loyalty Program Tier"
    fireEvent.change(titleInput, { target: { value: 'VIP Loyalty Program Tier' } });

    expect(titleInput.value).toBe('VIP Loyalty Program Tier');
    expect(keyInput.value).toBe('vipLoyaltyProgramTier');

    // Save
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(handleChange).toHaveBeenLastCalledWith({
      type: 'object',
      properties: {
        vipLoyaltyProgramTier: {
          title: 'VIP Loyalty Program Tier',
          type: 'string',
        },
      },
      required: ['vipLoyaltyProgramTier'],
    });
  });

  it('cancels edits and restores previous state', () => {
    const handleChange = jest.fn();
    const initialSchema = {
      type: 'object',
      properties: {
        vatNumber: {
          title: 'VAT Number',
          type: 'string',
        },
      },
    };

    render(<SchemaBuilder value={initialSchema} onChange={handleChange} />);

    // Click edit
    fireEvent.click(screen.getByTitle('Edit Field'));

    const titleInput = screen.getByPlaceholderText('e.g. BSB Number') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'New Temporary Title' } });

    // Click cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Should restore previous preview
    expect(screen.getByText('VAT Number')).toBeInTheDocument();
  });
});
