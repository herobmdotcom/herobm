import { render, screen } from '@testing-library/react';
import ContactsContent from '../ContactsContent';

let capturedProps: any = null;
jest.mock('@/components/shared/DataGrid', () => {
  return function DummyDataGrid(props: any) {
    capturedProps = props;
    return (
      <div data-testid="datagrid-mock">
        <div>{props.pageTitle}</div>
        {props.headerActions}
      </div>
    );
  };
});

describe('ContactsContent', () => {
  beforeEach(() => {
    capturedProps = null;
  });

  it('configures DataGrid with rowHref directing to Contact details page', () => {
    render(<ContactsContent />);

    expect(capturedProps).toBeDefined();
    expect(capturedProps.endpoint).toBe('/api/contacts');
    expect(capturedProps.rowIdField).toBe('contactId');

    // Verify rowHref maps to Contact details page URL
    const testHref = capturedProps.rowHref({ contactId: 'contact-abc-123' });
    expect(testHref).toBe('/crm/contacts/contact-abc-123');

    // Verify Create Contact button links to /crm/contacts/new
    const createButton = screen.getByRole('link', { name: 'Create Contact' });
    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveAttribute('href', '/crm/contacts/new');
  });
});
