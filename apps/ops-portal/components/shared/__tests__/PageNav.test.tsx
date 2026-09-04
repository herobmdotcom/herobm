import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PageNav, { PageSection } from '../PageNav';

describe('PageNav Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const mockSections: PageSection[] = [
    {
      id: 'tab-overview',
      label: 'Overview & Terms',
      isSubPage: true,
      isActive: false,
      onClick: jest.fn(),
      subtargets: [
        { id: 'info-section', label: 'Info', onClick: jest.fn() },
        { id: 'notes-section', label: 'Notes', onClick: jest.fn() },
        { id: 'activity-section', label: 'Activity', onClick: jest.fn() },
      ],
    },
    {
      id: 'tab-commercial',
      label: 'Commercial & Quotes',
      isSubPage: true,
      isActive: true,
      onClick: jest.fn(),
    },
    {
      id: 'tab-contacts',
      label: 'Contacts',
      isSubPage: true,
      isActive: false,
      onClick: jest.fn(),
    },
    {
      id: 'tab-hidden',
      label: 'Hidden Section',
      show: false,
      isSubPage: true,
      isActive: false,
    },
  ];

  it('renders visible tabs and does not render hidden tabs', () => {
    render(<PageNav sections={mockSections} />);

    expect(screen.getByText('Overview & Terms')).toBeInTheDocument();
    expect(screen.getByText('Commercial & Quotes')).toBeInTheDocument();
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Section')).not.toBeInTheDocument();
  });

  it('does not render subtargets when active tab has no subtargets and nothing is hovered', () => {
    render(<PageNav sections={mockSections} />);

    expect(screen.queryByText('Info')).not.toBeInTheDocument();
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();
  });

  it('renders active tab subtargets by default if active tab has subtargets', () => {
    const sectionsWithActiveSubtargets: PageSection[] = [
      {
        ...mockSections[0],
        isActive: true,
      },
      {
        ...mockSections[1],
        isActive: false,
      },
    ];

    render(<PageNav sections={sectionsWithActiveSubtargets} />);

    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('reveals subtargets when hovering a tab with subtargets', () => {
    render(<PageNav sections={mockSections} />);

    expect(screen.queryByText('Info')).not.toBeInTheDocument();

    const overviewTab = screen.getByText('Overview & Terms');
    fireEvent.mouseEnter(overviewTab);

    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('does NOT immediately close subtargets when moving across a tab without subtargets (grace period)', () => {
    render(<PageNav sections={mockSections} />);

    // Hover Overview & Terms to open subtargets
    const overviewTab = screen.getByText('Overview & Terms');
    fireEvent.mouseEnter(overviewTab);
    expect(screen.getByText('Info')).toBeInTheDocument();

    // User moves mouse towards Activity, crossing Commercial & Quotes (which has no subtargets)
    const commercialTab = screen.getByText('Commercial & Quotes');
    fireEvent.mouseEnter(commercialTab);

    // Subtargets should STILL be in the document during grace period (<200ms)
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();

    // After 200ms of lingering on the tab without subtargets, it should close
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.queryByText('Info')).not.toBeInTheDocument();
  });

  it('keeps subtargets open if the cursor reaches the subtargets row before grace period expires', () => {
    render(<PageNav sections={mockSections} />);

    // Hover Overview & Terms to open subtargets
    const overviewTab = screen.getByText('Overview & Terms');
    fireEvent.mouseEnter(overviewTab);
    expect(screen.getByText('Activity')).toBeInTheDocument();

    // Cursor crosses Commercial & Quotes
    const commercialTab = screen.getByText('Commercial & Quotes');
    fireEvent.mouseEnter(commercialTab);

    // Advance 50ms (simulating diagonal travel time)
    act(() => {
      jest.advanceTimersByTime(50);
    });

    // Cursor lands in subtargets row
    const activityBtn = screen.getByText('Activity');
    const subtargetsRow = activityBtn.parentElement!;
    fireEvent.mouseEnter(subtargetsRow);

    // Advance past 200ms - subtargets should STAY open because row cleared the timer
    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('executes subtarget onClick when clicked', () => {
    render(<PageNav sections={mockSections} />);

    const overviewTab = screen.getByText('Overview & Terms');
    fireEvent.mouseEnter(overviewTab);

    const activityBtn = screen.getByText('Activity');
    fireEvent.click(activityBtn);

    const activitySection = mockSections[0].subtargets![2];
    expect(activitySection.onClick).toHaveBeenCalled();
  });

  it('closes subtargets after 200ms when mouse leaves the navbar container', () => {
    const { container } = render(<PageNav sections={mockSections} />);

    const overviewTab = screen.getByText('Overview & Terms');
    fireEvent.mouseEnter(overviewTab);
    expect(screen.getByText('Info')).toBeInTheDocument();

    // Mouse leaves the outer container
    const outerContainer = container.firstChild as HTMLElement;
    fireEvent.mouseLeave(outerContainer);

    // Still open before timer
    expect(screen.getByText('Info')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.queryByText('Info')).not.toBeInTheDocument();
  });
});
