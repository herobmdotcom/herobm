import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CustomerDetailsTab } from '../CustomerDetailsTab';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, string>) => {
      if (key === 'options.inheritValue') {
        return `Inherit: ${params?.label} (from ${params?.source})`;
      }
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    baseCurrency: 'AUD',
    app: {
      defaultCustomerTermsId: 'term-default',
    },
  }),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  organizationsControllerGetSettings: jest.fn().mockResolvedValue({ data: {} }),
  customersControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  customerGroupsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  supplierGroupsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
}));

describe('CustomerDetailsTab Trading Terms UI Storage', () => {
  const mockCustomer = {
    customerId: 'cust-1',
    customerNumber: 'CUST-001',
    name: 'Test Customer',
    stateCode: 'active',
  };

  const mockTradingTerms = [
    { tradingTermsId: 'term-net30', code: 'NET30', description: '30 Days Net' },
    { tradingTermsId: 'term-net60', code: 'NET60', description: '60 Days Net' },
  ];

  const mockAccountGroups = [
    {
      customerGroupId: 'grp-1',
      groupCode: 'RETAIL',
      name: 'Retail Group',
      tradingTermsId: 'term-net30',
      creditLimit: '5000.00',
    },
  ];

  it('calls updateField and saveField with selected termId when changed in UI', async () => {
    const updateField = jest.fn();
    const saveField = jest.fn();

    await act(async () => {
      render(
        <CustomerDetailsTab
          customer={mockCustomer as any}
          dto={{
            customerId: 'cust-1',
            name: 'Test Customer',
            customerGroupId: 'grp-1',
            tradingTermsId: null,
          } as any}
          isEditable={true}
          saving={false}
          updateField={updateField}
          saveField={saveField}
          canManageCredit={true}
          taxPositions={[]}
          tradingTerms={mockTradingTerms as any}
          hasDiscountRules={false}
          creditAssessment={null}
          accountGroups={mockAccountGroups as any}
          paramsId="cust-1"
        />
      );
    });

    const selects = screen.getAllByRole('combobox');
    const tradingTermsSelect = selects.find((sel) =>
      Array.from((sel as HTMLSelectElement).options).some(
        (opt) => opt.value === 'term-net60'
      )
    ) as HTMLSelectElement;

    expect(tradingTermsSelect).toBeDefined();

    await act(async () => {
      fireEvent.change(tradingTermsSelect, { target: { value: 'term-net60' } });
    });

    expect(updateField).toHaveBeenCalledWith('tradingTermsId', 'term-net60');
    expect(saveField).toHaveBeenCalledWith('tradingTermsId', 'term-net60');
  });

  it('calls updateField and saveField with null when reset to inherit in UI', async () => {
    const updateField = jest.fn();
    const saveField = jest.fn();

    await act(async () => {
      render(
        <CustomerDetailsTab
          customer={mockCustomer as any}
          dto={{
            customerId: 'cust-1',
            name: 'Test Customer',
            customerGroupId: 'grp-1',
            tradingTermsId: 'term-net60',
          } as any}
          isEditable={true}
          saving={false}
          updateField={updateField}
          saveField={saveField}
          canManageCredit={true}
          taxPositions={[]}
          tradingTerms={mockTradingTerms as any}
          hasDiscountRules={false}
          creditAssessment={null}
          accountGroups={mockAccountGroups as any}
          paramsId="cust-1"
        />
      );
    });

    const selects = screen.getAllByRole('combobox');
    const tradingTermsSelect = selects.find((sel) =>
      Array.from((sel as HTMLSelectElement).options).some(
        (opt) => opt.value === 'term-net60'
      )
    ) as HTMLSelectElement;

    await act(async () => {
      fireEvent.change(tradingTermsSelect, { target: { value: '' } });
    });

    expect(updateField).toHaveBeenCalledWith('tradingTermsId', null);
    expect(saveField).toHaveBeenCalledWith('tradingTermsId', null);
  });
});
