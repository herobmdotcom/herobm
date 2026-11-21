import { render, screen, fireEvent } from '@testing-library/react';
import InheritedNumberInput from '../InheritedNumberInput';

describe('InheritedNumberInput', () => {
  it('renders inherited placeholder and tooltip when no local value is set', () => {
    const handleChange = jest.fn();
    render(
      <InheritedNumberInput
        value=""
        onChange={handleChange}
        inheritedValue="5000.00"
        inheritedSourceLabel="Customer Group VIP"
        placeholder="0.00"
      />
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.placeholder).toBe('5000.00');
    expect(input.getAttribute('title')).toBe('Inherited from Customer Group VIP: 5000.00');
    expect(input.value).toBe('');
  });

  it('renders local value and normal placeholder when local value is present', () => {
    const handleChange = jest.fn();
    render(
      <InheritedNumberInput
        value="2500"
        onChange={handleChange}
        inheritedValue="5000.00"
        inheritedSourceLabel="Customer Group VIP"
        placeholder="0.00"
      />
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('2500');
    expect(input.placeholder).toBe('0.00');
    expect(input.getAttribute('title')).toBeNull();
  });

  it('triggers onChange when value is entered', () => {
    const handleChange = jest.fn();
    render(
      <InheritedNumberInput
        value=""
        onChange={handleChange}
        inheritedValue="5000"
        inheritedSourceLabel="Customer Group"
      />
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1500' } });
    expect(handleChange).toHaveBeenCalledWith('1500');
  });

  it('renders default placeholder when neither local nor inherited value exists', () => {
    render(
      <InheritedNumberInput
        value=""
        onChange={jest.fn()}
        placeholder="Default Placeholder"
      />
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.placeholder).toBe('Default Placeholder');
    expect(input.getAttribute('title')).toBeNull();
  });
});
