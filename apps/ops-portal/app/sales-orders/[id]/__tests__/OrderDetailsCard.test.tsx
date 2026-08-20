import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderDetailsCard from '../OrderDetailsCard';
import { SALES_ORDER_STATE } from '@herobm/shared';

let mockUseSettingsReturn = {
  app: {
    salesAnalysisCodes: [
      { value: 'PROMO', order: 2 },
      { value: 'DEFAULT', order: 1 },
      { value: 'WHOLESALE', order: 3 },
    ],
  },
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => mockUseSettingsReturn,
}));

const mockOrder = {
  salesOrderId: 'so-123',
  orderNumber: 'SO-123',
  name: 'Test Order',
  stateCode: SALES_ORDER_STATE.DRAFT,
  customFields: { analysisCode: 'PROMO' },
} as unknown as Parameters<typeof OrderDetailsCard>[0]['order'];

describe('OrderDetailsCard - Analysis Code', () => {
  it('renders structured select dropdown with configured analysis codes sorted by order', () => {
    const saveHeader = jest.fn();
    const setEditAnalysisCode = jest.fn();

    render(
      <OrderDetailsCard
        order={mockOrder}
        isOrderDetailsEditable={true}
        editName="Test Order"
        setEditName={jest.fn()}
        editPO="PO-123"
        setEditPO={jest.fn()}
        editNotes=""
        setEditNotes={jest.fn()}
        editAnalysisCode="PROMO"
        setEditAnalysisCode={setEditAnalysisCode}
        saveHeader={saveHeader}
        onEmailDocumentClick={jest.fn()}
        reportError={jest.fn()}
        setError={jest.fn()}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('PROMO');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4); // — None —, DEFAULT, PROMO, WHOLESALE
    expect(options[0]).toHaveTextContent('— None —');
    expect(options[1]).toHaveTextContent('DEFAULT');
    expect(options[2]).toHaveTextContent('PROMO');
    expect(options[3]).toHaveTextContent('WHOLESALE');

    fireEvent.change(select, { target: { value: 'WHOLESALE' } });
    expect(setEditAnalysisCode).toHaveBeenCalledWith('WHOLESALE');
    expect(saveHeader).toHaveBeenCalledWith({
      customFields: { analysisCode: 'WHOLESALE' },
    });
  });

  it('renders custom option if order has an existing code not in configured list', () => {
    render(
      <OrderDetailsCard
        order={mockOrder}
        isOrderDetailsEditable={true}
        editName="Test Order"
        setEditName={jest.fn()}
        editPO="PO-123"
        setEditPO={jest.fn()}
        editNotes=""
        setEditNotes={jest.fn()}
        editAnalysisCode="LEGACY_CODE"
        setEditAnalysisCode={jest.fn()}
        saveHeader={jest.fn()}
        onEmailDocumentClick={jest.fn()}
        reportError={jest.fn()}
        setError={jest.fn()}
      />
    );

    expect(screen.getByText('LEGACY_CODE (Custom)')).toBeInTheDocument();
  });

  it('falls back to input when no analysis codes are configured', () => {
    mockUseSettingsReturn = {
      app: {
        salesAnalysisCodes: [],
      },
    };

    render(
      <OrderDetailsCard
        order={mockOrder}
        isOrderDetailsEditable={true}
        editName="Test Order"
        setEditName={jest.fn()}
        editPO="PO-123"
        setEditPO={jest.fn()}
        editNotes=""
        setEditNotes={jest.fn()}
        editAnalysisCode="CUSTOM"
        setEditAnalysisCode={jest.fn()}
        saveHeader={jest.fn()}
        onEmailDocumentClick={jest.fn()}
        reportError={jest.fn()}
        setError={jest.fn()}
      />
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Q3_PROMO')).toBeInTheDocument();
  });
});
