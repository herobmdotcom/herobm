import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SnapshotTabContainer, SnapshotItem } from '../SnapshotTabContainer';

interface MockItem extends SnapshotItem {
  id: string;
  field1?: string;
  field2?: string;
}

describe('SnapshotTabContainer', () => {
  const defaultProps = {
    title: 'Test Tab',
    icon: 'test_icon',
    idField: 'id' as const,
    loading: false,
    onUpdate: jest.fn(),
    onCreate: jest.fn(),
    renderFields: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    defaultProps.renderFields.mockImplementation((item, isLatest, handleUpdate) => (
      <div data-testid="mock-fields">
        <input 
          data-testid="field1" 
          defaultValue={item.field1 || ''} 
          disabled={!isLatest}
          onBlur={(e) => handleUpdate('field1', e.target.value)}
        />
      </div>
    ));
  });

  it('renders loading state when items is empty and loading is true', () => {
    render(<SnapshotTabContainer {...defaultProps} items={[]} loading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty draft state with Add New Snapshot button', () => {
    render(<SnapshotTabContainer {...defaultProps} items={[]} />);
    expect(screen.getByPlaceholderText('e.g. Q3 Assessment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    expect(screen.getByTestId('mock-fields')).toBeInTheDocument();
  });

  it('triggers onCreate when typing into blank draft', async () => {
    render(<SnapshotTabContainer {...defaultProps} items={[]} />);
    
    const snapshotNameInput = screen.getByPlaceholderText('e.g. Q3 Assessment');
    fireEvent.change(snapshotNameInput, { target: { value: 'New Snapshot' } });
    fireEvent.blur(snapshotNameInput);

    await waitFor(() => {
      expect(defaultProps.onCreate).toHaveBeenCalledWith(expect.objectContaining({
        snapshotName: 'New Snapshot'
      }));
    });
  });

  it('triggers onCreate when clicking Add New Snapshot button from empty state', async () => {
    render(<SnapshotTabContainer {...defaultProps} items={[]} />);
    
    const addButton = screen.getByRole('button', { name: /Add New Snapshot/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(defaultProps.onCreate).toHaveBeenCalledWith({});
    });
  });

  it('renders populated state with multiple items correctly', () => {
    const items: MockItem[] = [
      { id: '1', snapshotName: 'Latest Snapshot', field1: 'Value 1' },
      { id: '2', snapshotName: 'Older Snapshot', field1: 'Value 2' },
    ];
    
    render(<SnapshotTabContainer {...defaultProps} items={items} />);
    
    // Should have 2 mock fields rendered
    const fields = screen.getAllByTestId('field1');
    expect(fields).toHaveLength(2);
    
    // First one should be enabled (isLatest = true)
    expect(fields[0]).not.toBeDisabled();
    expect(fields[0]).toHaveValue('Value 1');
    
    // Second one should be disabled (isLatest = false)
    expect(fields[1]).toBeDisabled();
    expect(fields[1]).toHaveValue('Value 2');
    
    // Should have the Add New Snapshot button
    expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
  });

  it('triggers onUpdate when editing fields on the latest snapshot', async () => {
    const items: MockItem[] = [
      { id: '1', snapshotName: 'Latest Snapshot', field1: 'Value 1' },
    ];
    
    render(<SnapshotTabContainer {...defaultProps} items={items} />);
    
    const field1 = screen.getByTestId('field1');
    fireEvent.change(field1, { target: { value: 'Updated Value 1' } });
    fireEvent.blur(field1);

    expect(defaultProps.onUpdate).toHaveBeenCalledWith('1', 'field1', 'Updated Value 1');
  });

  it('triggers onUpdate when editing snapshot name on latest snapshot', async () => {
    const items: MockItem[] = [
      { id: '1', snapshotName: 'Latest Snapshot' },
    ];
    
    render(<SnapshotTabContainer {...defaultProps} items={items} />);
    
    const snapshotNameInput = screen.getAllByPlaceholderText('e.g. Q3 Assessment')[0];
    fireEvent.change(snapshotNameInput, { target: { value: 'Updated Name' } });
    fireEvent.blur(snapshotNameInput);

    expect(defaultProps.onUpdate).toHaveBeenCalledWith('1', 'snapshotName', 'Updated Name');
  });
});
