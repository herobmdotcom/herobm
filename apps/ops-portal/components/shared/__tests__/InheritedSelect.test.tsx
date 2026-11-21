import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import InheritedSelect from '../InheritedSelect';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    if (key === 'options.inheritValue') {
      return `Inherit: ${params?.label} (from ${params?.source})`;
    }
    if (key === 'options.none') {
      return 'None';
    }
    return key;
  },
}));

describe('InheritedSelect', () => {
  const options = [
    { value: 'term-1', label: 'Net 30 Days' },
    { value: 'term-2', label: 'Net 60 Days' },
    { value: 'term-3', label: 'COD Cash on Delivery' },
  ];

  it('renders inherited option as the top option when inherited value is provided', () => {
    const handleChange = jest.fn();
    render(
      <InheritedSelect
        value=""
        onChange={handleChange}
        options={options}
        inheritedValue="term-2"
        inheritedSourceLabel="Group Wholesale"
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(select.options[0].textContent).toBe('Inherit: Net 60 Days (from Group Wholesale)');
    expect(select.getAttribute('title')).toBe('Inherit: Net 60 Days (from Group Wholesale)');
  });

  it('renders None option when no inherited value exists', () => {
    render(
      <InheritedSelect
        value=""
        onChange={jest.fn()}
        options={options}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options[0].textContent).toBe('None');
    expect(select.getAttribute('title')).toBeNull();
  });

  it('displays selected local override value and removes tooltip', () => {
    render(
      <InheritedSelect
        value="term-1"
        onChange={jest.fn()}
        options={options}
        inheritedValue="term-2"
        inheritedSourceLabel="Group Wholesale"
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('term-1');
    expect(select.getAttribute('title')).toBeNull();
  });

  it('calls onChange with selected value or empty string when resetting to inherit', () => {
    const handleChange = jest.fn();
    render(
      <InheritedSelect
        value="term-1"
        onChange={handleChange}
        options={options}
        inheritedValue="term-2"
        inheritedSourceLabel="Group Wholesale"
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'term-3' } });
    expect(handleChange).toHaveBeenCalledWith('term-3');

    fireEvent.change(select, { target: { value: '' } });
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('falls back to string representation of inheritedValue if not found in options', () => {
    render(
      <InheritedSelect
        value=""
        onChange={jest.fn()}
        options={options}
        inheritedValue="unlisted-term-id"
        inheritedSourceLabel="Group Enterprise"
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options[0].textContent).toBe('Inherit: unlisted-term-id (from Group Enterprise)');
  });
});
