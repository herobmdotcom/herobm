import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductSearchInput from '../ProductSearchInput';
import * as api from '@herobm/sdk';

// Mock next-intl translations
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock sdk
jest.mock('@herobm/sdk', () => ({
  productsControllerFindAll: jest.fn(),
}));

describe('ProductSearchInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches for products using the canonical ?q= parameter instead of ?search=', async () => {
    // Return empty results for the search endpoint
    (api.productsControllerFindAll as jest.Mock).mockResolvedValueOnce({ data: [] });
    
    const handleSelect = jest.fn();
    render(<ProductSearchInput onSelect={handleSelect} />);
    
    const user = userEvent.setup();
    const input = screen.getByRole('textbox'); // Matches the <input />
    
    // Type into the combobox
    await user.type(input, 'wire');
    
    // Wait for the debounced search to fire (300ms delay in component)
    await waitFor(() => {
      expect(api.productsControllerFindAll).toHaveBeenCalled();
    }, { timeout: 1000 });
    
    // Assert exactly what URL the component requested
    expect(api.productsControllerFindAll).toHaveBeenCalledWith({ q: 'wire', limit: 10 });
  });

});
