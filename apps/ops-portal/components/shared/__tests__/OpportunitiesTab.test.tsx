import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { OpportunitiesTab } from '../OpportunitiesTab';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  ...jest.requireActual('@herobm/sdk'),
  setSdkConfig: jest.fn(),
  getSdkConfig: jest.fn(),
  opportunitiesControllerFindAll: jest.fn(),
}));

describe('OpportunitiesTab Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders New Opportunity action button without an icon', async () => {
    (api.opportunitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: { data: [] },
    });

    render(<OpportunitiesTab entityId="contact-123" entityType="contact" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading opportunities...')).not.toBeInTheDocument();
    });

    const buttonLink = screen.getByRole('link', { name: 'New Opportunity' });
    expect(buttonLink).toBeInTheDocument();
    expect(buttonLink).toHaveAttribute('href', '/crm/opportunities/new');
    
    // Ensure button has primary action variant styling class
    expect(buttonLink.className).toContain('bg-[var(--accent)]');

    // Ensure there is no material icon inside or adjacent to the button text
    const icon = buttonLink.querySelector('.material-symbols-outlined');
    expect(icon).toBeNull();
  });
});
