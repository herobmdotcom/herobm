import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductQuickAddBar from '../ProductQuickAddBar';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@herobm/sdk', () => ({
  productsControllerFindAll: jest.fn(),
  productsControllerFindOne: jest.fn(),
}));

const mockProducts = [
  { productId: 'p-1', productNumber: 'WDG-001', name: 'Widget Alpha', listPrice: '10.00' },
  { productId: 'p-2', productNumber: 'WDG-002', name: 'Widget Beta', listPrice: '20.00' },
];

describe('ProductQuickAddBar & AsyncSelect keyboard workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({ data: mockProducts });
    (api.productsControllerFindOne as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve({ data: mockProducts.find((p) => p.productId === id) })
    );
  });

  it('supports full zero-mouse entry: / shortcut -> type -> ArrowDown -> Enter -> type qty -> Enter -> refocus search', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ProductQuickAddBar onAdd={onAdd} enableShortcut />);

    const searchInput = screen.getByRole('textbox');
    expect(document.activeElement).not.toBe(searchInput);

    // 1. Press '/' globally to focus the search box
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(searchInput);

    // 2. Type search term and wait for results
    await user.type(searchInput, 'WDG');
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    // First option is highlighted by default
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    // 3. ArrowDown moves highlight to second option, Enter selects it
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');

    // 4. Staged product chip appears and qty input is focused
    const qtyInput = await screen.findByRole('spinbutton', { name: 'qtyLabel' });
    expect(screen.getByText('WDG-002')).toBeInTheDocument();
    expect(document.activeElement).toBe(qtyInput);
    expect(qtyInput).toHaveValue(1);

    // 5. Type quantity and press Enter
    await user.clear(qtyInput);
    await user.type(qtyInput, '15{Enter}');

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(mockProducts[1], '15');
    });

    // 6. Returns to product search input with focus restored
    await waitFor(() => {
      const nextSearchInput = screen.getByRole('textbox');
      expect(document.activeElement).toBe(nextSearchInput);
    });
  });

  it('cancels staged product on Escape and returns focus to search', async () => {
    const onAdd = jest.fn();
    const user = userEvent.setup();

    render(<ProductQuickAddBar onAdd={onAdd} enableShortcut />);

    const searchInput = screen.getByRole('textbox');
    await user.type(searchInput, 'WDG');
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    // Select first item with Enter
    await user.keyboard('{Enter}');

    const qtyInput = await screen.findByRole('spinbutton', { name: 'qtyLabel' });
    expect(document.activeElement).toBe(qtyInput);

    // Escape cancels without calling onAdd
    await user.keyboard('{Escape}');
    expect(onAdd).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('textbox'));
    });
  });

  it('ignores / shortcut when focus is already inside another input', () => {
    const onAdd = jest.fn();
    render(
      <div>
        <input data-testid="other-input" />
        <ProductQuickAddBar onAdd={onAdd} enableShortcut />
      </div>
    );

    const otherInput = screen.getByTestId('other-input');
    otherInput.focus();
    fireEvent.keyDown(otherInput, { key: '/' });

    expect(document.activeElement).toBe(otherInput);
  });
});
