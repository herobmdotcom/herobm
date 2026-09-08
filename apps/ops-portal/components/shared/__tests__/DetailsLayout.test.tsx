import React from 'react';
import { render, screen } from '@testing-library/react';
import DetailsLayout from '../DetailsLayout';

// Mock PrintButton so test doesn't depend on window.print
jest.mock('../PrintButton', () => {
  return function MockPrintButton() {
    return <button type="button">Print</button>;
  };
});

describe('DetailsLayout Component', () => {
  it('renders header and children with default full width and left alignment', () => {
    render(
      <DetailsLayout
        header={<div data-testid="test-header">Header Content</div>}
      >
        <div data-testid="test-child">Main Content</div>
      </DetailsLayout>,
    );

    expect(screen.getByTestId('test-header')).toBeInTheDocument();
    expect(screen.getByTestId('test-child')).toBeInTheDocument();

    const headerInner = screen.getByTestId('test-header').parentElement;
    expect(headerInner).toHaveClass('w-full');
    expect(headerInner).not.toHaveClass('mx-auto');
  });

  it('applies constrained maxWidth presets and center alignment', () => {
    render(
      <DetailsLayout
        header={<div data-testid="test-header">Header Content</div>}
        maxWidth="6xl"
        align="center"
      >
        <div data-testid="test-child">Main Content</div>
      </DetailsLayout>,
    );

    const headerInner = screen.getByTestId('test-header').parentElement;
    expect(headerInner).toHaveClass('max-w-6xl');
    expect(headerInner).toHaveClass('mx-auto');

    const contentInner = screen.getByTestId('test-child').parentElement;
    expect(contentInner).toHaveClass('max-w-6xl');
    expect(contentInner).toHaveClass('mx-auto');
  });

  it('supports other standard maxWidth presets like 5xl, 7xl, and 1600', () => {
    const { rerender } = render(
      <DetailsLayout
        header={<div data-testid="test-header">Header Content</div>}
        maxWidth="5xl"
      >
        <div data-testid="test-child">Main Content</div>
      </DetailsLayout>,
    );

    expect(screen.getByTestId('test-header').parentElement).toHaveClass('max-w-5xl');

    rerender(
      <DetailsLayout
        header={<div data-testid="test-header">Header Content</div>}
        maxWidth="7xl"
      >
        <div data-testid="test-child">Main Content</div>
      </DetailsLayout>,
    );

    expect(screen.getByTestId('test-header').parentElement).toHaveClass('max-w-7xl');

    rerender(
      <DetailsLayout
        header={<div data-testid="test-header">Header Content</div>}
        maxWidth="1600"
      >
        <div data-testid="test-child">Main Content</div>
      </DetailsLayout>,
    );

    expect(screen.getByTestId('test-header').parentElement).toHaveClass('max-w-[1600px]');
  });

  it('renders footer actions and print button when enabled', () => {
    render(
      <DetailsLayout
        header={<div>Header</div>}
        footerActions={<button type="button">Save Action</button>}
        showPrint={true}
      >
        <div>Content</div>
      </DetailsLayout>,
    );

    expect(screen.getByRole('button', { name: /Print/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Action/i })).toBeInTheDocument();
  });

  it('hides print button when showPrint is false', () => {
    render(
      <DetailsLayout
        header={<div>Header</div>}
        showPrint={false}
      >
        <div>Content</div>
      </DetailsLayout>,
    );

    expect(screen.queryByRole('button', { name: /Print/i })).not.toBeInTheDocument();
  });
});
