import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PickingOrderLinesView, { PickingLine } from '../PickingOrderLinesView';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

const mockLines: PickingLine[] = [
  {
    salesOrderLineId: 'line-1',
    lineNumber: 1,
    productId: 'prod-1',
    productNumber: 'PRD-001',
    productDescription: 'Widget Alpha',
    quantity: '10',
    quantityPicked: '0',
    remaining: '10',
    onHand: '25',
    isFullyPicked: false,
    isPhysical: true,
    availableBins: [
      { binId: 'bin-1', binName: 'A-01-01', onHand: '25' },
    ],
  },
];

describe('PickingOrderLinesView', () => {
  it('enables pick button when valid quantity and bin are selected and disabled is false', () => {
    const onPickLine = jest.fn();
    const pickInputs = {
      'line-1': { quantity: '5', binId: 'bin-1' },
    };

    render(
      <PickingOrderLinesView
        lines={mockLines}
        pickInputs={pickInputs}
        onPickLine={onPickLine}
        disabled={false}
      />
    );

    const pickButtons = screen.getAllByRole('button', { name: 'buttons.pick' });
    expect(pickButtons.length).toBeGreaterThan(0);
    expect(pickButtons[0]).not.toBeDisabled();

    fireEvent.click(pickButtons[0]);
    expect(onPickLine).toHaveBeenCalledWith('line-1');
  });

  it('disables pick button when disabled prop is true (e.g., credit hold)', () => {
    const onPickLine = jest.fn();
    const pickInputs = {
      'line-1': { quantity: '5', binId: 'bin-1' },
    };

    render(
      <PickingOrderLinesView
        lines={mockLines}
        pickInputs={pickInputs}
        onPickLine={onPickLine}
        disabled={true}
      />
    );

    const pickButtons = screen.getAllByRole('button', { name: 'buttons.pick' });
    expect(pickButtons.length).toBeGreaterThan(0);
    pickButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });

    fireEvent.click(pickButtons[0]);
    expect(onPickLine).not.toHaveBeenCalled();
  });

  it('disables pick button when bin or quantity is missing in pickInputs', () => {
    render(
      <PickingOrderLinesView
        lines={mockLines}
        pickInputs={{}}
        disabled={false}
      />
    );

    const pickButtons = screen.getAllByRole('button', { name: 'buttons.pick' });
    pickButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('hides pick buttons when readOnly is true', () => {
    render(
      <PickingOrderLinesView
        lines={mockLines}
        readOnly={true}
      />
    );

    const pickButtons = screen.queryAllByRole('button', { name: 'buttons.pick' });
    expect(pickButtons).toHaveLength(0);
  });
});
