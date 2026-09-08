import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrganizationForm from '../OrganizationForm';
import * as api from '@herobm/sdk';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      cancel: 'Cancel',
      saving: 'Saving...',
      yes: 'Yes',
      no: 'No',
      notConfigured: 'Not Configured',
    };
    return map[key] || key;
  },
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    organization: { country: 'AU' },
    app: {
      organizationTags: [{ value: 'VIP', order: 1 }],
      referralModes: [{ value: 'Partner', order: 1 }],
    },
  }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  organizationsControllerCreate: jest.fn(),
  organizationsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  contactsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  usersControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
}));

describe('OrganizationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Cancel and Create Organization buttons in the EntityHeader', async () => {
    render(<OrganizationForm isNew />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Organization' })).toBeInTheDocument();
  });

  it('disables the Create Organization button when name is empty and enables when filled', async () => {
    render(<OrganizationForm isNew />);

    const createBtn = screen.getByRole('button', { name: 'Create Organization' });
    expect(createBtn).toBeDisabled();

    const nameInput = screen.getByPlaceholderText('e.g. Acme Holdings');
    fireEvent.change(nameInput, { target: { value: 'Global Corp' } });

    expect(createBtn).toBeEnabled();
  });

  it('navigates to /crm/organizations when Cancel is clicked', async () => {
    render(<OrganizationForm isNew />);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(mockPush).toHaveBeenCalledWith('/crm/organizations');
  });

  it('submits the form and redirects to organization details page on successful creation', async () => {
    (api.organizationsControllerCreate as jest.Mock).mockResolvedValue({
      data: { organizationId: 'org-999' },
    });

    render(<OrganizationForm isNew />);

    const nameInput = screen.getByPlaceholderText('e.g. Acme Holdings');
    fireEvent.change(nameInput, { target: { value: 'Global Corp' } });

    const createBtn = screen.getByRole('button', { name: 'Create Organization' });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(api.organizationsControllerCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Global Corp',
          headquartersCountry: 'AU',
        })
      );
      expect(mockPush).toHaveBeenCalledWith('/crm/organizations/org-999');
    });
  });

  it('renders Account Owner select with unassigned default and submits selected ownerId', async () => {
    (api.usersControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        { userId: 'user-1', displayName: 'Jane Doe', username: 'jdoe' },
        { userId: 'user-2', displayName: null, username: 'jsmith' },
      ],
    });
    (api.organizationsControllerCreate as jest.Mock).mockResolvedValue({
      data: { organizationId: 'org-1000' },
    });

    render(<OrganizationForm isNew />);

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('jsmith')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('e.g. Acme Holdings');
    fireEvent.change(nameInput, { target: { value: 'Owned Corp' } });

    const ownerSelect = screen.getByLabelText('Account Owner');
    expect(ownerSelect).toHaveValue('');

    fireEvent.change(ownerSelect, { target: { value: 'user-1' } });
    expect(ownerSelect).toHaveValue('user-1');

    const createBtn = screen.getByRole('button', { name: 'Create Organization' });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(api.organizationsControllerCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Owned Corp',
          ownerId: 'user-1',
        })
      );
    });
  });
});
