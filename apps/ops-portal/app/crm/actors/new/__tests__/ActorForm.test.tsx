import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ActorForm from '../ActorForm';
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
      actorTags: [{ value: 'VIP', order: 1 }],
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
  actorsControllerCreate: jest.fn(),
  actorsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  contactsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
}));

describe('ActorForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Cancel and Create Actor buttons in the EntityHeader', async () => {
    render(<ActorForm isNew />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Actor' })).toBeInTheDocument();
  });

  it('disables the Create Actor button when name is empty and enables when filled', async () => {
    render(<ActorForm isNew />);

    const createBtn = screen.getByRole('button', { name: 'Create Actor' });
    expect(createBtn).toBeDisabled();

    const nameInput = screen.getByPlaceholderText('e.g. Acme Holdings');
    fireEvent.change(nameInput, { target: { value: 'Global Corp' } });

    expect(createBtn).toBeEnabled();
  });

  it('navigates to /crm/actors when Cancel is clicked', async () => {
    render(<ActorForm isNew />);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(mockPush).toHaveBeenCalledWith('/crm/actors');
  });

  it('submits the form and redirects to actor details page on successful creation', async () => {
    (api.actorsControllerCreate as jest.Mock).mockResolvedValue({
      data: { actorId: 'act-999' },
    });

    render(<ActorForm isNew />);

    const nameInput = screen.getByPlaceholderText('e.g. Acme Holdings');
    fireEvent.change(nameInput, { target: { value: 'Global Corp' } });

    const createBtn = screen.getByRole('button', { name: 'Create Actor' });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(api.actorsControllerCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Global Corp',
          headquartersCountry: 'AU',
        })
      );
      expect(mockPush).toHaveBeenCalledWith('/crm/actors/act-999');
    });
  });
});
