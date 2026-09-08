import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactAffiliationsTab } from '../ContactAffiliationsTab';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

jest.mock('@/components/shared/OrganizationSelect', () => () => <div data-testid="organization-select" />);

let mockAppSettings: { organizationContactRoles?: Array<{ value: string; order: number }> } | null = null;
jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    app: mockAppSettings,
  }),
}));

jest.mock('@herobm/sdk', () => ({
  setSdkConfig: jest.fn(),
  organizationsControllerAddContact: jest.fn(),
  organizationsControllerRemoveContact: jest.fn(),
}));

describe('ContactAffiliationsTab (Organizations tab)', () => {
  const mockContact = {
    contactId: 'contact-1',
    firstName: 'Pete',
    lastName: 'Mitchell',
    organizationContactLinks: [
      {
        linkId: 'link-1',
        organizationId: 'org-101',
        primaryFor: ['sales', 'accounts'],
        organization: {
          organizationId: 'org-101',
          name: 'DMM HYDRAULICS',
          industry: 'Manufacturing',
          headquartersCity: 'Melbourne',
          headquartersCountry: 'Australia',
        },
      },
    ],
  } as unknown as api.ContactResponseDto;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Organizations section heading and Link Organization action button', () => {
    render(
      <ContactAffiliationsTab
        contactId="contact-1"
        contact={mockContact}
        onAffiliationUpdated={jest.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /organizations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link Organization' })).toBeInTheDocument();
  });

  it('renders horizontal card for linked organization with details and no shadow classes', () => {
    const { container } = render(
      <ContactAffiliationsTab
        contactId="contact-1"
        contact={mockContact}
        onAffiliationUpdated={jest.fn()}
      />
    );

    expect(screen.getByText('DMM HYDRAULICS')).toBeInTheDocument();
    expect(screen.getByText('Industry: Manufacturing')).toBeInTheDocument();
    expect(screen.getByText('Location: Melbourne, Australia')).toBeInTheDocument();
    expect(screen.getByText('sales')).toBeInTheDocument();
    expect(screen.getByText('accounts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeInTheDocument();

    // Verify there are no shadow classes in the rendered container
    const shadowElements = container.querySelectorAll('[class*="shadow"]');
    expect(shadowElements.length).toBe(0);
  });

  it('renders empty state when no organizations are linked', () => {
    const emptyContact = {
      contactId: 'contact-2',
      firstName: 'Jane',
      lastName: 'Doe',
      organizationContactLinks: [],
    } as unknown as api.ContactResponseDto;

    render(
      <ContactAffiliationsTab
        contactId="contact-2"
        contact={emptyContact}
        onAffiliationUpdated={jest.fn()}
      />
    );

    expect(screen.getByText('No organizations linked to this contact yet.')).toBeInTheDocument();
  });

  it('renders linking form with "Save Link" button and default roles when Link Organization is clicked', async () => {
    mockAppSettings = null;
    const { container } = render(
      <ContactAffiliationsTab
        contactId="contact-1"
        contact={mockContact}
        onAffiliationUpdated={jest.fn()}
      />
    );

    const linkOrgBtn = screen.getByRole('button', { name: 'Link Organization' });
    fireEvent.click(linkOrgBtn);

    expect(screen.getByText('Link to Organization')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Link' })).toBeInTheDocument();
    expect(screen.queryByText('Save Affiliation')).not.toBeInTheDocument();

    // Verify canonical default roles are present
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Purchasing')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();

    // Verify no grey background classes like bg-[var(--bg-secondary)] on the form container
    const greyElements = container.querySelectorAll('.bg-\\[var\\(--bg-secondary\\)\\]');
    expect(greyElements.length).toBe(0);
  });

  it('renders custom organization contact roles dynamically loaded from settings', () => {
    mockAppSettings = {
      organizationContactRoles: [
        { value: 'Procurement Specialist', order: 1 },
        { value: 'Accounts Receivable', order: 2 },
      ],
    };

    render(
      <ContactAffiliationsTab
        contactId="contact-1"
        contact={mockContact}
        onAffiliationUpdated={jest.fn()}
      />
    );

    const linkOrgBtn = screen.getByRole('button', { name: 'Link Organization' });
    fireEvent.click(linkOrgBtn);

    expect(screen.getByText('Procurement Specialist')).toBeInTheDocument();
    expect(screen.getByText('Accounts Receivable')).toBeInTheDocument();
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument();
  });
});
