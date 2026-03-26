import { BadRequestException } from '@nestjs/common';
import { validateReturnQuantity } from './returns-math.utils';

describe('Returns Math Logic (Pure)', () => {
  it('should allow returning exactly the original quantity if nothing is returned yet', () => {
    expect(() => validateReturnQuantity(5, 5, 0, 1)).not.toThrow();
  });

  it('should allow returning a partial amount the first time', () => {
    expect(() => validateReturnQuantity(2, 5, 0, 1)).not.toThrow();
  });

  it('should allow returning the remainder amount', () => {
    expect(() => validateReturnQuantity(3, 5, 2, 1)).not.toThrow();
  });

  it('should restrict returning quantity less than or equal to 0', () => {
    expect(() => validateReturnQuantity(0, 5, 0, 1)).toThrow(BadRequestException);
    expect(() => validateReturnQuantity(-1, 5, 0, 1)).toThrow(BadRequestException);
  });

  it('should restrict returning more than the original quantity', () => {
    expect(() => validateReturnQuantity(6, 5, 0, 1)).toThrow(BadRequestException);
  });

  it('should restrict returning more than the remaining permissible quantity', () => {
    // 5 ordered, 4 already returned. Trying to return 2 should fail (5-4 = 1 max).
    expect(() => validateReturnQuantity(2, 5, 4, 1)).toThrow(BadRequestException);
  });

  it('should correctly parse strings for float amounts', () => {
    expect(() => validateReturnQuantity("2.5", "5.0", "1.0", 1)).not.toThrow();
  });
});
