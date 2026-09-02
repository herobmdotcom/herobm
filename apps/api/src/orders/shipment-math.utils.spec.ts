import { BadRequestException } from '@nestjs/common';
import { validateShipmentQuantity } from './shipment-math.utils';

describe('Shipment Math Logic (Pure)', () => {
  it('should allow shipping if requested equals available picked stock', () => {
    // 5 picked, 0 committed, requesting 5. Max available is 5.
    expect(() => validateShipmentQuantity(5, 5, 0, 1)).not.toThrow();
  });

  it('should allow partial shipments of available picked stock', () => {
    expect(() => validateShipmentQuantity(3, 5, 0, 1)).not.toThrow();
  });

  it('should allow the remainder to be shipped after a previous partial shipment', () => {
    // 5 picked, 2 already committed. Requesting 3.
    expect(() => validateShipmentQuantity(3, 5, 2, 1)).not.toThrow();
  });

  it('should restrict shipping 0 or negative quantities', () => {
    expect(() => validateShipmentQuantity(0, 5, 0, 1)).toThrow(
      BadRequestException,
    );
    expect(() => validateShipmentQuantity(-2, 5, 0, 1)).toThrow(
      BadRequestException,
    );
  });

  it('should restrict shipping more than what was picked', () => {
    expect(() => validateShipmentQuantity(6, 5, 0, 1)).toThrow(
      BadRequestException,
    );
  });

  it('should restrict shipping more than remaining available when partially committed', () => {
    // 5 picked, 3 already shipped/committed elsewhere. Only 2 available. Requesting 3 fails.
    expect(() => validateShipmentQuantity(3, 5, 3, 1)).toThrow(
      BadRequestException,
    );
  });

  it('should correctly parse strings for float amounts', () => {
    expect(() =>
      validateShipmentQuantity('2.5', '5.0', '1.5', 1),
    ).not.toThrow();
  });
});
