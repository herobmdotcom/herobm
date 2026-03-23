import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductSearchInput from '../ProductSearchInput';
import { apiFetch } from '../../../lib/api';

// Mock next-intl translations
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock our configured API fetcher
jest.mock('../../../lib/api', () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe('ProductSearchInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches for products using the canonical ?q= parameter instead of ?search=', async () => {
    // Return empty results for the search endpoint
    mockApiFetch.mockResolvedValueOnce({ data: [] });
    
    const handleSelect = jest.fn();
    render(<ProductSearchInput onSelect={handleSelect} />);
    
    const user = userEvent.setup();
    const input = screen.getByRole('textbox'); // Matches the <input />
    
    // Type into the combobox
    await user.type(input, 'wire');
    
    // Wait for the debounced search to fire (300ms delay in component)
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    }, { timeout: 1000 });
    
    // Assert exactly what URL the component requested
    expect(mockApiFetch).toHaveBeenCalledWith('/api/products?q=wire&limit=10');
  });

  it('fetches inventory levels using correct productIds after product search', async () => {
    // First call: product search returns two products
    mockApiFetch.mockResolvedValueOnce({
      data: [
        { productId: 'aaa-111', name: 'Widget A' },
        { productId: 'bbb-222', name: 'Widget B' },
      ],
    });
    // Second call: inventory endpoint
    mockApiFetch.mockResolvedValueOnce({ data: [] });

    const handleSelect = jest.fn();
    render(<ProductSearchInput onSelect={handleSelect} />);

    const user = userEvent.setup();
    const input = screen.getByRole('textbox');
    await user.type(input, 'widget');

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    }, { timeout: 1000 });

    // Second call should be the inventory endpoint with comma-separated IDs
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/inventory/by-products?productIds=aaa-111,bbb-222',
    );
  });
});
