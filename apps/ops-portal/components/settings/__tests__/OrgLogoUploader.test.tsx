import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrgLogoUploader from '../OrgLogoUploader';
import { apiUpload } from '@/lib/api';
import * as api from '@herobm/sdk';
import toast from 'react-hot-toast';

jest.mock('@/lib/api', () => ({
  apiUpload: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  organizationControllerRemoveLogo: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: 'Company Logo',
      upload: 'Upload Logo',
      change: 'Change Logo',
      remove: 'Remove Logo',
      confirmRemove: 'Are you sure you want to remove the logo?',
      uploadSuccess: 'Logo updated successfully',
      removeSuccess: 'Logo removed successfully',
      uploadError: 'Failed to process logo',
      maxSize: 'Image exceeds 5MB or invalid format',
    };
    return map[key] || key;
  },
}));

describe('OrgLogoUploader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders upload placeholder when no logoUrl is provided', () => {
    render(<OrgLogoUploader logoUrl={null} companyName="Acme Corp" />);
    expect(screen.getByText('Upload Logo')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders logo image when logoUrl is provided', () => {
    render(<OrgLogoUploader logoUrl="organization/test_logo.png" companyName="Acme Corp" />);
    const img = screen.getByRole('img', { name: 'Acme Corp' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      expect.stringContaining('/api/storage/images/organization/test_logo.png'),
    );
  });

  it('validates file size and rejects file over 5MB', async () => {
    render(<OrgLogoUploader logoUrl={null} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.png', {
      type: 'image/png',
    });
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Image exceeds 5MB or invalid format');
    });
    expect(apiUpload).not.toHaveBeenCalled();
  });

  it('validates file type and rejects unsupported format', async () => {
    render(<OrgLogoUploader logoUrl={null} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const textFile = new File(['text'], 'document.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [textFile] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Image exceeds 5MB or invalid format');
    });
    expect(apiUpload).not.toHaveBeenCalled();
  });

  it('uploads valid image file and notifies parent via onLogoUpdated', async () => {
    const onLogoUpdated = jest.fn();
    (apiUpload as jest.Mock).mockResolvedValue({
      logoUrl: 'organization/new_logo.png',
    });

    render(<OrgLogoUploader logoUrl={null} onLogoUpdated={onLogoUpdated} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const validFile = new File(['dummy-img'], 'logo.png', {
      type: 'image/png',
    });
    Object.defineProperty(validFile, 'size', { value: 1024 });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(apiUpload).toHaveBeenCalledWith(
        '/api/settings/organization/logo',
        expect.any(FormData),
      );
      expect(toast.success).toHaveBeenCalledWith('Logo updated successfully');
      expect(onLogoUpdated).toHaveBeenCalledWith('organization/new_logo.png');
    });
  });

  it('removes logo when remove button is clicked and confirmed', async () => {
    const onLogoUpdated = jest.fn();
    window.confirm = jest.fn().mockReturnValue(true);
    (api.organizationControllerRemoveLogo as jest.Mock).mockResolvedValue({});

    render(
      <OrgLogoUploader
        logoUrl="organization/logo.png"
        companyName="Acme Corp"
        onLogoUpdated={onLogoUpdated}
      />,
    );

    const removeBtn = screen.getByTitle('Remove Logo');
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(api.organizationControllerRemoveLogo).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Logo removed successfully');
      expect(onLogoUpdated).toHaveBeenCalledWith(null);
    });
  });

  it('opens preview modal when logo image is clicked', () => {
    render(
      <OrgLogoUploader
        logoUrl="organization/logo.png"
        companyName="Acme Corp"
      />,
    );

    const img = screen.getByRole('img', { name: 'Acme Corp' });
    fireEvent.click(img);

    // Modal renders company name title and full image
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
  });
});
