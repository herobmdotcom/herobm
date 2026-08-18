import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { HelpDrawer } from '../HelpDrawer';
import { HelpProvider, useHelp } from '../HelpContext';
import { Button } from '@/components/shared/Button';
import { customFetch } from '@herobm/sdk';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/sales-orders',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-intl translations
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock @herobm/sdk
jest.mock('@herobm/sdk', () => {
  const original = jest.requireActual('@herobm/sdk');
  return {
    ...original,
    customFetch: jest.fn(),
  };
});

const mockTopic = {
  id: 'sales-orders',
  title: 'Sales Order Management',
  category: 'Sales',
  description: 'Manage sales orders and pricing.',
  routes: ['/sales-orders'],
  tags: ['sales', 'orders'],
  fields: {
    customer_id: {
      title: 'Customer',
      summary: 'Target customer account',
    },
  },
  content: '# Sales Orders\n\n> [!NOTE]\n> Test note alert.\n\nParagraph text here.',
  related: ['invoices'],
};

describe('MarkdownRenderer', () => {
  it('renders markdown headers, paragraphs, and custom alerts', () => {
    const markdown = `# Main Title\n\n> [!NOTE]\n> Important context\n\nRegular paragraph content.`;
    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByText('Main Title')).toBeInTheDocument();
    expect(screen.getByText('Regular paragraph content.')).toBeInTheDocument();
    expect(screen.getByText('Important context')).toBeInTheDocument();
    expect(screen.getByText('NOTE')).toBeInTheDocument();
  });
});

describe('HelpDrawer & HelpContext', () => {
  const mockCustomFetch = customFetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCustomFetch.mockImplementation((url: string) => {
      if (url.startsWith('/help/context')) {
        return Promise.resolve({
          data: {
            topic: mockTopic,
            matchedRoute: '/sales-orders',
            relatedTopics: [{ id: 'invoices', title: 'Invoices', category: 'Sales' }],
          },
        });
      }
      if (url === '/help/topics') {
        return Promise.resolve({
          data: [
            {
              id: 'sales-orders',
              title: 'Sales Order Management',
              category: 'Sales',
              description: 'Manage sales orders.',
              order: 1,
              routes: ['/sales-orders'],
              tags: ['sales'],
            },
          ],
        });
      }
      if (url.startsWith('/help/search')) {
        return Promise.resolve({
          data: [
            {
              id: 'sales-orders',
              title: 'Sales Order Management',
              category: 'Sales',
              snippet: 'Manage sales orders...',
              score: 100,
            },
          ],
        });
      }
      return Promise.resolve({ data: null });
    });
  });

  function TestWrapper() {
    const { openHelp } = useHelp();
    return (
      <div>
        <Button onClick={() => openHelp()}>Open Help</Button>
        <HelpDrawer />
      </div>
    );
  }

  it('opens help drawer and displays contextual topic and field reference', async () => {
    render(
      <HelpProvider>
        <TestWrapper />
      </HelpProvider>,
    );

    // Click open button
    fireEvent.click(screen.getByText('Open Help'));

    await waitFor(() => {
      expect(screen.getByText('Sales Order Management')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('Target customer account')).toBeInTheDocument();
    });
  });

  it('allows switching to Table of Contents tab', async () => {
    render(
      <HelpProvider>
        <TestWrapper />
      </HelpProvider>,
    );

    fireEvent.click(screen.getByText('Open Help'));

    await waitFor(() => {
      expect(screen.getByText('tocTab')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('tocTab'));

    await waitFor(() => {
      expect(screen.getByText('categories')).toBeInTheDocument();
    });
  });

  it('allows searching topics in Search tab', async () => {
    render(
      <HelpProvider>
        <TestWrapper />
      </HelpProvider>,
    );

    fireEvent.click(screen.getByText('Open Help'));

    await waitFor(() => {
      expect(screen.getByText('searchTab')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('searchTab'));

    const searchInput = screen.getByPlaceholderText('search');
    await userEvent.type(searchInput, 'sales');

    await waitFor(() => {
      expect(mockCustomFetch).toHaveBeenCalledWith(
        expect.stringContaining('/help/search?q=sales'),
        expect.anything(),
      );
    });
  });
});
