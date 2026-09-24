import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DynamicForm } from '../DynamicForm';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('DynamicForm', () => {
  const sampleSchema = {
    type: 'object',
    properties: {
      serialNumber: { type: 'string', title: 'Serial Number' },
      leadTimeDays: { type: 'number', title: 'Lead Time (Days)' },
      isFragile: { type: 'boolean', title: 'Fragile' },
      category: { type: 'string', title: 'Category', enum: ['Standard', 'Premium', 'Deluxe'] },
      specialInstructions: { type: 'string', format: 'textarea', title: 'Special Instructions' },
    },
    required: ['serialNumber'],
  };

  it('renders all form fields from the schema', () => {
    render(
      <DynamicForm
        schema={sampleSchema}
        data={{ serialNumber: 'SN-100', isFragile: true, category: 'Standard' }}
      />,
    );

    expect(screen.getByText(/Serial Number/i)).toBeInTheDocument();
    expect(screen.getByText(/Lead Time \(Days\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Fragile/i)).toBeInTheDocument();
    expect(screen.getByText(/Category/i)).toBeInTheDocument();
    expect(screen.getByText(/Special Instructions/i)).toBeInTheDocument();
  });

  it('fires onChange on keystrokes and only fires onBlur on blur for text inputs', () => {
    const handleChange = jest.fn();
    const handleBlur = jest.fn();

    render(
      <DynamicForm
        schema={sampleSchema}
        data={{ serialNumber: 'ABC' }}
        onChange={handleChange}
        onBlur={handleBlur}
      />,
    );

    const input = screen.getByDisplayValue('ABC');

    // Keystroke 1
    fireEvent.change(input, { target: { value: 'ABCD' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith({ serialNumber: 'ABCD' });
    expect(handleBlur).not.toHaveBeenCalled();

    // Keystroke 2
    fireEvent.change(input, { target: { value: 'ABCDE' } });
    expect(handleChange).toHaveBeenCalledTimes(2);
    expect(handleChange).toHaveBeenCalledWith({ serialNumber: 'ABCDE' });
    expect(handleBlur).not.toHaveBeenCalled();

    // Blur
    fireEvent.blur(input, { target: { value: 'ABCDE' } });
    expect(handleBlur).toHaveBeenCalledTimes(1);
    expect(handleBlur).toHaveBeenCalledWith({ serialNumber: 'ABCDE' });
  });

  it('fires onChange on keystrokes and only fires onBlur on blur for number inputs', () => {
    const handleChange = jest.fn();
    const handleBlur = jest.fn();

    render(
      <DynamicForm
        schema={sampleSchema}
        data={{ leadTimeDays: 5 }}
        onChange={handleChange}
        onBlur={handleBlur}
      />,
    );

    const input = screen.getByDisplayValue('5');

    fireEvent.change(input, { target: { value: '10' } });
    expect(handleChange).toHaveBeenCalledWith({ leadTimeDays: 10 });
    expect(handleBlur).not.toHaveBeenCalled();

    fireEvent.blur(input, { target: { value: '10' } });
    expect(handleBlur).toHaveBeenCalledWith({ leadTimeDays: 10 });
  });

  it('fires onBlur immediately when boolean switch is toggled', () => {
    const handleChange = jest.fn();
    const handleBlur = jest.fn();

    render(
      <DynamicForm
        schema={sampleSchema}
        data={{ isFragile: false }}
        onChange={handleChange}
        onBlur={handleBlur}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith({ isFragile: true });
    expect(handleBlur).toHaveBeenCalledWith({ isFragile: true });
  });

  it('fires onBlur immediately when enum select changes', () => {
    const handleChange = jest.fn();
    const handleBlur = jest.fn();

    render(
      <DynamicForm
        schema={sampleSchema}
        data={{ category: 'Standard' }}
        onChange={handleChange}
        onBlur={handleBlur}
      />,
    );

    const select = screen.getByDisplayValue('Standard');
    fireEvent.change(select, { target: { value: 'Deluxe' } });

    expect(handleChange).toHaveBeenCalledWith({ category: 'Deluxe' });
    expect(handleBlur).toHaveBeenCalledWith({ category: 'Deluxe' });
  });

  it('does not fire onChange or onBlur when readOnly is true', () => {
    const handleChange = jest.fn();
    const handleBlur = jest.fn();

    render(
      <DynamicForm
        schema={sampleSchema}
        data={{ serialNumber: 'READONLY_1' }}
        onChange={handleChange}
        onBlur={handleBlur}
        readOnly={true}
      />,
    );

    const input = screen.getByDisplayValue('READONLY_1');
    expect(input).toBeDisabled();

    fireEvent.change(input, { target: { value: 'MODIFIED' } });
    expect(handleChange).not.toHaveBeenCalled();

    fireEvent.blur(input, { target: { value: 'MODIFIED' } });
    expect(handleBlur).not.toHaveBeenCalled();
  });
});
