import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Switch } from '../Switch';

describe('Switch Component', () => {
  it('renders with correct aria attributes when unchecked', () => {
    render(<Switch checked={false} title="Toggle setting" />);
    const toggle = screen.getByRole('switch', { name: 'Toggle setting' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveClass('bg-gray-300');
  });

  it('renders with correct aria attributes and accent color when checked', () => {
    render(<Switch checked={true} title="Toggle setting" />);
    const toggle = screen.getByRole('switch', { name: 'Toggle setting' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveClass('bg-[var(--accent)]');
  });

  it('calls onCheckedChange with negated value on click', () => {
    const handleCheckedChange = jest.fn();
    render(<Switch checked={false} onCheckedChange={handleCheckedChange} />);
    
    fireEvent.click(screen.getByRole('switch'));
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not trigger onCheckedChange when disabled', () => {
    const handleCheckedChange = jest.fn();
    render(<Switch checked={false} disabled onCheckedChange={handleCheckedChange} />);
    
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(handleCheckedChange).not.toHaveBeenCalled();
  });
});
