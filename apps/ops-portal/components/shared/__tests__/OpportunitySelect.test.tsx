import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import * as api from '@herobm/sdk';
import OpportunitySelect from '../OpportunitySelect';

const mockT = (key: string) => key;
jest.mock('next-intl', () => ({
  useTranslations: () => mockT,
}));

jest.mock('@herobm/sdk', () => ({
  ...jest.requireActual('@herobm/sdk'),
  opportunitiesControllerFindAll: jest.fn(),
}));

describe('OpportunitySelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial display value and placeholder', () => {
    render(
      <OpportunitySelect
        value="opp-1"
        initialSearchTerm="Acme Software Deal"
        onChange={jest.fn()}
      />
    );

    const input = screen.getByDisplayValue('Acme Software Deal');
    expect(input).toBeInTheDocument();
  });

  it('searches and selects an opportunity', async () => {
    const mockOpportunities = [
      {
        opportunityId: 'opp-1',
        name: 'Enterprise Cloud Migration',
        status: 'proposal',
        estimatedValue: 50000,
        currencyCode: 'USD',
      },
      {
        opportunityId: 'opp-2',
        name: 'Hardware Refresh',
        status: 'qualified',
        estimatedValue: 12000,
        currencyCode: 'USD',
      },
    ];

    (api.opportunitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: {
        data: mockOpportunities,
      },
    });

    const handleChange = jest.fn();

    render(
      <OpportunitySelect
        value={null}
        placeholder="Select opportunity..."
        onChange={handleChange}
      />
    );

    const input = screen.getByPlaceholderText('Select opportunity...');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Cloud' } });
    });

    await waitFor(() => {
      expect(api.opportunitiesControllerFindAll).toHaveBeenCalled();
      expect(screen.getByText('Enterprise Cloud Migration')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.mouseDown(screen.getByText('Enterprise Cloud Migration'));
    });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        opportunityId: 'opp-1',
        name: 'Enterprise Cloud Migration',
      })
    );
  });

  it('disables input when disabled prop is true', () => {
    render(
      <OpportunitySelect
        value="opp-1"
        initialSearchTerm="Locked Opportunity"
        disabled={true}
        onChange={jest.fn()}
      />
    );

    const input = screen.getByDisplayValue('Locked Opportunity');
    expect(input).toBeDisabled();
  });
});
