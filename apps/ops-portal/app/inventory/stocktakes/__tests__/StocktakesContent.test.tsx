import React from 'react';
import { render, screen } from '@testing-library/react';
import StocktakesContent from '../StocktakesContent';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/components/DataGrid', () => {
  return function MockDataGrid(props: any) {
    return (
      <div data-testid="mock-datagrid">
        <h1>{props.pageTitle}</h1>
        <div data-testid="header-actions">{props.headerActions}</div>
      </div>
    );
  };
});

jest.mock('../CreateStocktakeSlideOver', () => {
  return function MockCreateSlideOver() {
    return <div data-testid="mock-create-slide-over" />;
  };
});

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      title: 'Stocktakes',
      createNew: 'Create Stocktake',
      stocktakeNumber: 'Stocktake #',
      name: 'Name',
      location: 'Location',
      status: 'Status',
      scope: 'Scope',
      blind: 'Blind',
      progress: 'Progress',
      discrepancies: 'Discrepancies',
      created: 'Created',
      createdBy: 'Created By',
      yes: 'Yes',
      no: 'No',
    };
    const t = (key: string) => messages[key] || key;
    t.has = () => true;
    return t;
  },
}));

describe('StocktakesContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title and Create Stocktake action button without Workflow Guide button', () => {
    render(<StocktakesContent />);

    expect(screen.getByText('Stocktakes')).toBeInTheDocument();
    expect(screen.getByText('Create Stocktake')).toBeInTheDocument();
    expect(screen.queryByText('Workflow Guide')).not.toBeInTheDocument();
  });
});
