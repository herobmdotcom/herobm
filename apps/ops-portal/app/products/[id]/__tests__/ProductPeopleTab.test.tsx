import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductPeopleTab } from '../ProductPeopleTab';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  productsControllerGetServiceMembers: jest.fn(),
  productsControllerAddServiceMember: jest.fn(),
  productsControllerRemoveServiceMember: jest.fn(),
  projectsControllerFindAllResources: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProductPeopleTab Component', () => {
  const mockProductId = 'prod-srv-1';
  const mockProductName = 'Senior Consulting';
  const mockProductNumber = 'SRV-CONSULT';

  const mockMembers = [
    {
      memberId: 'mem-1',
      productId: mockProductId,
      resourceId: 'res-1',
      name: 'Alice Architect',
      resourceNumber: 'RES-001',
      userId: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      createdOn: '2026-01-15T10:00:00Z',
    },
  ];

  const mockResources = [
    {
      resourceId: 'res-1',
      resourceNumber: 'RES-001',
      name: 'Alice Architect',
      resourceType: 'person',
      user: {
        userId: 'user-1',
        username: 'alice',
        displayName: 'Alice Architect',
        email: 'alice@example.com',
      },
    },
    {
      resourceId: 'res-2',
      resourceNumber: 'RES-002',
      name: 'Bob Builder',
      resourceType: 'person',
      user: {
        userId: 'user-2',
        username: 'bob',
        displayName: 'Bob Builder',
        email: 'bob@example.com',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.productsControllerGetServiceMembers as jest.Mock).mockResolvedValue({
      data: mockMembers,
    });
    (api.projectsControllerFindAllResources as jest.Mock).mockResolvedValue({
      data: mockResources,
    });
  });

  it('renders service team members list using horizontal cards', async () => {
    render(
      <ProductPeopleTab
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isEditable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Architect')).toBeInTheDocument();
      expect(screen.getByText(/@alice/)).toBeInTheDocument();
      expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no team members assigned', async () => {
    (api.productsControllerGetServiceMembers as jest.Mock).mockResolvedValue({
      data: [],
    });

    render(
      <ProductPeopleTab
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isEditable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('people.empty')).toBeInTheDocument();
    });
  });

  it('allows assigning a new person to the service product', async () => {
    const user = userEvent.setup();
    (api.productsControllerAddServiceMember as jest.Mock).mockResolvedValue({
      data: { memberId: 'mem-2' },
    });

    render(
      <ProductPeopleTab
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isEditable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Architect')).toBeInTheDocument();
    });

    const assignBtn = screen.getByText('people.assignPerson');
    await user.click(assignBtn);

    // Modal is open, select Bob
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'res-2');

    const submitButtons = screen.getAllByText('people.assignPerson');
    const submitBtn = submitButtons[submitButtons.length - 1];
    await user.click(submitBtn);

    await waitFor(() => {
      expect(api.productsControllerAddServiceMember).toHaveBeenCalledWith(
        mockProductId,
        { resourceId: 'res-2' }
      );
    });
  });

  it('allows removing an assigned person', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockImplementation(() => true);
    (api.productsControllerRemoveServiceMember as jest.Mock).mockResolvedValue({
      data: { success: true },
    });

    render(
      <ProductPeopleTab
        productId={mockProductId}
        productName={mockProductName}
        productNumber={mockProductNumber}
        isEditable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Architect')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('delete');
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(api.productsControllerRemoveServiceMember).toHaveBeenCalledWith(
        mockProductId,
        'res-1'
      );
    });
  });
});
