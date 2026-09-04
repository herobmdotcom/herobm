import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

const mockPdfTemplatesControllerRunHook = jest.fn().mockResolvedValue({
  data: new Blob(['pdf'], { type: 'application/pdf' }),
});
jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  pdfTemplatesControllerRunHook: (...args: any[]) =>
    mockPdfTemplatesControllerRunHook(...args),
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

describe('OrderDetailsCard - Document Actions', () => {
  beforeAll(() => {
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/blob');
    window.open = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Print Quote and Email Quote for draft orders and triggers onPrintDocumentClick', async () => {
    const onEmail = jest.fn();
    const onPrint = jest.fn();
    render(
      <OrderDetailsCard
        order={{ ...mockOrder, stateCode: SALES_ORDER_STATE.DRAFT }}
        isOrderDetailsEditable={true}
        editName="Test Order"
        setEditName={jest.fn()}
        editPO="PO-123"
        setEditPO={jest.fn()}
        editNotes=""
        setEditNotes={jest.fn()}
        editAnalysisCode="PROMO"
        setEditAnalysisCode={jest.fn()}
        saveHeader={jest.fn()}
        onEmailDocumentClick={onEmail}
        onPrintDocumentClick={onPrint}
        reportError={jest.fn()}
        setError={jest.fn()}
      />
    );

    const printQuoteBtn = screen.getByRole('button', { name: /buttons\.printQuote/i });
    expect(printQuoteBtn).toBeInTheDocument();

    const emailQuoteBtn = screen.getByRole('button', { name: /buttons\.emailQuote/i });
    expect(emailQuoteBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(printQuoteBtn);
    });

    expect(onPrint).toHaveBeenCalledWith(
      'sales-order-quote',
      'Print Quote',
      'Quote',
      'Quote',
      'so-123',
      'sales-order'
    );
  });

  it('renders Print Confirmation and Email Confirmation for confirmed orders and triggers onPrintDocumentClick', async () => {
    const onEmail = jest.fn();
    const onPrint = jest.fn();
    render(
      <OrderDetailsCard
        order={{ ...mockOrder, stateCode: SALES_ORDER_STATE.CONFIRMED }}
        isOrderDetailsEditable={false}
        editName="Test Order"
        setEditName={jest.fn()}
        editPO="PO-123"
        setEditPO={jest.fn()}
        editNotes=""
        setEditNotes={jest.fn()}
        editAnalysisCode="PROMO"
        setEditAnalysisCode={jest.fn()}
        saveHeader={jest.fn()}
        onEmailDocumentClick={onEmail}
        onPrintDocumentClick={onPrint}
        reportError={jest.fn()}
        setError={jest.fn()}
      />
    );

    const printConfirmationBtn = screen.getByRole('button', { name: /buttons\.printConfirmation/i });
    expect(printConfirmationBtn).toBeInTheDocument();

    const emailConfirmationBtn = screen.getByRole('button', { name: /buttons\.emailConfirmation/i });
    expect(emailConfirmationBtn).toBeInTheDocument();

    const emailProFormaBtn = screen.getByRole('button', { name: /buttons\.emailProForma/i });
    expect(emailProFormaBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(printConfirmationBtn);
    });

    expect(onPrint).toHaveBeenCalledWith(
      'sales-order-confirmation',
      'Print Confirmation',
      'Order Confirmation',
      'Confirmation',
      'so-123',
      'sales-order'
    );
  });

  it('renders linked opportunity with navigation link when opportunityId is present', () => {
    render(
      <OrderDetailsCard
        order={{
          ...mockOrder,
          opportunityId: 'opp-456',
          opportunityName: 'Metro Rail Expansion',
        }}
        isOrderDetailsEditable={false}
        editName="Test Order"
        setEditName={jest.fn()}
        editPO="PO-123"
        setEditPO={jest.fn()}
        editNotes=""
        setEditNotes={jest.fn()}
        editAnalysisCode="PROMO"
        setEditAnalysisCode={jest.fn()}
        saveHeader={jest.fn()}
        onEmailDocumentClick={jest.fn()}
        reportError={jest.fn()}
        setError={jest.fn()}
      />
    );

    expect(screen.getByText('Opportunity')).toBeInTheDocument();
    const oppLink = screen.getByRole('link', { name: 'Metro Rail Expansion' });
    expect(oppLink).toBeInTheDocument();
    expect(oppLink).toHaveAttribute('href', '/crm/opportunities/opp-456');
  });
});
