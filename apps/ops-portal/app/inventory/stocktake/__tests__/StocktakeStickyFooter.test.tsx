import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StocktakeStickyFooter from '../components/StocktakeStickyFooter';
import { StocktakeItem } from '../types';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params?.count !== undefined) {
        return `${key}:${params.count}`;
      }
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

describe('StocktakeStickyFooter Component', () => {
  const sampleItem: StocktakeItem = {
    id: 'bin-1_prod-1',
    productId: 'prod-1',
    productNumber: 'SKU-001',
    productName: 'Precision Widget',
    barcode: '123456789012',
    binId: 'bin-1',
    binNumber: 'A-01-01',
    locationId: 'loc-1',
    locationCode: 'WH-MAIN',
    expectedQuantity: 10,
    countedQuantity: null,
    baseUom: 'PCS',
    isUnlisted: false,
  };

  const onUpdateCount = jest.fn();
  const onIncrement = jest.fn();
  const onUpdateNotes = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when selectedItem is null', () => {
    const { container } = render(
      <StocktakeStickyFooter
        selectedItem={null}
        onUpdateCount={onUpdateCount}
        onIncrement={onIncrement}
        onUpdateNotes={onUpdateNotes}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders action buttons and triggers increment and set zero actions', async () => {
    const user = userEvent.setup();

    render(
      <StocktakeStickyFooter
        selectedItem={sampleItem}
        onUpdateCount={onUpdateCount}
        onIncrement={onIncrement}
        onUpdateNotes={onUpdateNotes}
      />
    );

    // Verify buttons are rendered
    expect(screen.getByRole('button', { name: 'Set count to 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 1 to count' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 5 to count' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 10 to count' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add or edit item notes' })).toBeInTheDocument();

    // Clear and -1 buttons should be present but disabled when uncounted
    const clearBtn = screen.getByRole('button', { name: 'Clear count' });
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).toBeDisabled();

    const minusOneBtn = screen.getByRole('button', { name: 'Subtract 1 from count' });
    expect(minusOneBtn).toBeInTheDocument();
    expect(minusOneBtn).toBeDisabled();

    // Click 0
    await user.click(screen.getByRole('button', { name: 'Set count to 0' }));
    expect(onUpdateCount).toHaveBeenCalledWith('bin-1_prod-1', 0);

    // Click +1
    await user.click(screen.getByRole('button', { name: 'Add 1 to count' }));
    expect(onIncrement).toHaveBeenCalledWith('bin-1_prod-1', 1);

    // Click +5
    await user.click(screen.getByRole('button', { name: 'Add 5 to count' }));
    expect(onIncrement).toHaveBeenCalledWith('bin-1_prod-1', 5);

    // Click +10
    await user.click(screen.getByRole('button', { name: 'Add 10 to count' }));
    expect(onIncrement).toHaveBeenCalledWith('bin-1_prod-1', 10);
  });

  it('renders clear and -1 buttons enabled when count > 0 and clicking -1 calls onIncrement(-1)', async () => {
    const user = userEvent.setup();

    const countedItem: StocktakeItem = {
      ...sampleItem,
      countedQuantity: 5,
    };

    render(
      <StocktakeStickyFooter
        selectedItem={countedItem}
        onUpdateCount={onUpdateCount}
        onIncrement={onIncrement}
        onUpdateNotes={onUpdateNotes}
      />
    );

    const minusOneBtn = screen.getByRole('button', { name: 'Subtract 1 from count' });
    expect(minusOneBtn).toBeInTheDocument();
    expect(minusOneBtn).not.toBeDisabled();

    await user.click(minusOneBtn);
    expect(onIncrement).toHaveBeenCalledWith('bin-1_prod-1', -1);

    const clearBtn = screen.getByRole('button', { name: 'Clear count' });
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).not.toBeDisabled();

    await user.click(clearBtn);
    expect(onUpdateCount).toHaveBeenCalledWith('bin-1_prod-1', null);
  });

  it('toggles note editing form, hides other action buttons, and submits note', async () => {
    const user = userEvent.setup();

    render(
      <StocktakeStickyFooter
        selectedItem={sampleItem}
        onUpdateCount={onUpdateCount}
        onIncrement={onIncrement}
        onUpdateNotes={onUpdateNotes}
      />
    );

    const notesBtn = screen.getByRole('button', { name: 'Add or edit item notes' });
    await user.click(notesBtn);

    // When Note is opened, 2x2 action buttons should be hidden
    expect(screen.queryByRole('button', { name: 'Set count to 0' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add 1 to count' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add 5 to count' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add 10 to count' })).not.toBeInTheDocument();

    const noteInput = screen.getByPlaceholderText('notesPlaceholder');
    expect(noteInput).toBeInTheDocument();

    await user.type(noteInput, 'Damaged packaging in row 2');
    const saveNoteBtn = screen.getByRole('button', { name: 'saveNote' });
    await user.click(saveNoteBtn);

    expect(onUpdateNotes).toHaveBeenCalledWith('bin-1_prod-1', 'Damaged packaging in row 2');

    // After saving, action buttons return
    expect(screen.getByRole('button', { name: 'Add 1 to count' })).toBeInTheDocument();
  });
});
