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

    const selects = screen.getAllByRole('combobox');
    const analysisSelect = selects[0];
    expect(analysisSelect).toBeInTheDocument();
    expect(analysisSelect).toHaveValue('PROMO');

    fireEvent.change(analysisSelect, { target: { value: 'WHOLESALE' } });
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

  it('renders select dropdown with None and custom option when no analysis codes are configured', () => {
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

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toBeInTheDocument();
    expect(screen.getByText('CUSTOM (Custom)')).toBeInTheDocument();
  });

  it('renders dispatch notification contact select and saves on selection', () => {
    const saveHeader = jest.fn();
    const setEditDispatchContactId = jest.fn();
    const contacts = [
      {
        contactId: 'c-1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        primaryFor: ['delivery'],
      },
      {
        contactId: 'c-2',
        fullName: 'John Smith',
        email: 'john@example.com',
        primaryFor: ['purchasing'],
      },
    ] as any;

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
        setEditAnalysisCode={jest.fn()}
        customerContacts={contacts}
        editDispatchContactId=""
        setEditDispatchContactId={setEditDispatchContactId}
        saveHeader={saveHeader}
        onEmailDocumentClick={jest.fn()}
        reportError={jest.fn()}
        setError={jest.fn()}
      />
    );

    const selects = screen.getAllByRole('combobox');
    const dispatchSelect = selects[1];
    expect(dispatchSelect).toBeInTheDocument();

    fireEvent.change(dispatchSelect, { target: { value: 'c-1' } });
    expect(setEditDispatchContactId).toHaveBeenCalledWith('c-1');
    expect(saveHeader).toHaveBeenCalledWith({
      customFields: {
        analysisCode: 'PROMO',
        dispatchContactId: 'c-1',
      },
    });

    fireEvent.change(dispatchSelect, { target: { value: 'none' } });
    expect(setEditDispatchContactId).toHaveBeenCalledWith('none');
    expect(saveHeader).toHaveBeenCalledWith({
      customFields: {
        analysisCode: 'PROMO',
        dispatchContactId: 'none',
      },
    });
  });
});
