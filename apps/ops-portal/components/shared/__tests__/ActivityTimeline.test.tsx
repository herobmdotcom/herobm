import { render, screen } from '@testing-library/react';
import ActivityTimeline, { TimelineEvent } from '../ActivityTimeline';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const fn = (key: string) => key;
    fn.has = () => true;
    return fn;
  },
}));

describe('ActivityTimeline Component', () => {
  it('renders empty message when events array is empty', () => {
    render(<ActivityTimeline events={[]} emptyMessage="No activity recorded" />);
    expect(screen.getByText('No activity recorded')).toBeInTheDocument();
  });

  it('renders events with entityDisplayName and formats object diff payloads', () => {
    const events: TimelineEvent[] = [
      {
        eventId: 'evt-1',
        eventType: 'status_changed',
        entityDisplayName: 'test_user',
        actor: 'admin',
        createdOn: '2026-09-08T10:00:00Z',
        payload: {
          role: { from: 'viewer', to: 'admin' },
          customProp: 'customValue',
        },
      },
    ];

    render(<ActivityTimeline events={events} defaultOpen={true} />);

    expect(screen.getByText('(test_user)')).toBeInTheDocument();
    expect(screen.getByText('viewer → admin')).toBeInTheDocument();
    expect(screen.getByText('customValue')).toBeInTheDocument();
  });
});
