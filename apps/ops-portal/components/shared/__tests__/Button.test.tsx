import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from '../Button';

describe('Button Component', () => {
  it('renders children correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
  });

  it('renders material icon when icon prop is provided', () => {
    render(<Button icon="edit" aria-label="Edit Item" />);
    const button = screen.getByRole('button', { name: 'Edit Item' });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('edit')).toHaveClass('material-symbols-outlined');
    expect(button).toHaveClass('w-8'); // defaults to size="icon"
  });

  it('renders either text or icon, not both (icon takes precedence when provided)', () => {
    render(<Button icon="delete">Delete Item</Button>);
    expect(screen.getByText('delete')).toBeInTheDocument();
    expect(screen.queryByText('Delete Item')).not.toBeInTheDocument();
  });

  it('renders progress_activity spinner and disables button when loading={true}', () => {
    const handleClick = jest.fn();
    render(<Button loading onClick={handleClick}>Save Changes</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('progress_activity')).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies variant and size classes properly', () => {
    render(<Button variant="primary" size="sm">Primary Small</Button>);
    const button = screen.getByRole('button', { name: 'Primary Small' });
    expect(button).toHaveClass('bg-[var(--accent)]');
    expect(button).toHaveClass('text-[12px]');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Action</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Action' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
