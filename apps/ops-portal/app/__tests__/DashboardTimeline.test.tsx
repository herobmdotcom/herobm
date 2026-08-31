import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardTimeline from '../DashboardTimeline';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: { count?: number }) => {
    if (params?.count !== undefined) {
      return `${key}:${params.count}`;
    }
    return key;
  },
}));

jest.mock('@herobm/sdk', () => ({
  dashboardControllerGetTimeline: jest.fn(),
}));

describe('DashboardTimeline', () => {
  const mockGetTimeline = api.dashboardControllerGetTimeline as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and renders timeline events', async () => {
    mockGetTimeline.mockResolvedValue({
      data: {
        events: [
          {
            eventId: 'evt-1',
            eventType: 'sales_order.created',
            entityId: 'so-1',
            entityDisplay: 'SO-1001',
            actor: 'alice',
            timestamp: new Date().toISOString(),
          },
          {
            eventId: 'evt-2',
            eventType: 'work_order.created',
            entityId: 'wo-1',
            entityDisplay: 'WO-2001',
            actor: 'bob',
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    render(<DashboardTimeline enabledEvents={['sales_order.created', 'work_order.created']} />);

    await waitFor(() => {
      expect(mockGetTimeline).toHaveBeenCalledWith({
        types: 'sales_order.created,work_order.created',
        limit: '20',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('SO-1001')).toBeInTheDocument();
      expect(screen.getByText('WO-2001')).toBeInTheDocument();
    });
  });

  it('renders empty state when no events are returned', async () => {
    mockGetTimeline.mockResolvedValue({
      data: {
        events: [],
      },
    });

    render(<DashboardTimeline enabledEvents={['sales_order.created']} />);

    await waitFor(() => {
      expect(screen.getByText('empty')).toBeInTheDocument();
    });
  });

  it('renders error state and retries on click', async () => {
    mockGetTimeline.mockRejectedValueOnce(new Error('Network error'));

    render(<DashboardTimeline enabledEvents={['sales_order.created']} />);

    await waitFor(() => {
      expect(screen.getByText('errors.failedToLoad')).toBeInTheDocument();
    });

    mockGetTimeline.mockResolvedValueOnce({
      data: {
        events: [
          {
            eventId: 'evt-1',
            eventType: 'sales_order.created',
            entityId: 'so-1',
            entityDisplay: 'SO-1001',
            actor: 'alice',
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    const retryBtn = screen.getByText('errors.retry');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('SO-1001')).toBeInTheDocument();
    });
  });
});
