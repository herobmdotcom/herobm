import { BadRequestException } from '@nestjs/common';
import {
  calculatePickAllocations,
  AvailableBin,
  FallbackBin,
} from './picking-math.utils';

describe('Picking Math Logic (Pure)', () => {
  const fallback: FallbackBin = { binId: 'fallback-bin', locationId: 'loc-1' };

  it('should return empty allocations when delta is 0', () => {
    const allocations = calculatePickAllocations(0, [], fallback);
    expect(allocations).toEqual([]);
  });

  describe('Positive Deltas (Picking Items)', () => {
    it('should allocate from a single bin if it has enough stock', () => {
      const availableBins: AvailableBin[] = [
        { binId: 'bin-a', locationId: 'loc-1', actualQuantity: 10 },
      ];
      const allocations = calculatePickAllocations(4, availableBins, fallback);

      expect(allocations).toEqual([
        { sourceBinId: 'bin-a', locationId: 'loc-1', takeQuantity: 4 },
      ]);
    });

    it('should split allocation across multiple bins when required', () => {
      const availableBins: AvailableBin[] = [
        { binId: 'bin-a', locationId: 'loc-1', actualQuantity: 4 },
        { binId: 'bin-b', locationId: 'loc-1', actualQuantity: 8 },
      ];
      const allocations = calculatePickAllocations(10, availableBins, fallback);

      expect(allocations).toEqual([
        { sourceBinId: 'bin-a', locationId: 'loc-1', takeQuantity: 4 },
        { sourceBinId: 'bin-b', locationId: 'loc-1', takeQuantity: 6 },
      ]);
    });

    it('should fall back to the fallback_bin if remaining stock is insufficient', () => {
      const availableBins: AvailableBin[] = [
        { binId: 'bin-a', locationId: 'loc-1', actualQuantity: 5 },
      ];
      // We want 8, but only 5 are physically on shelves
      const allocations = calculatePickAllocations(8, availableBins, fallback);

      expect(allocations).toEqual([
        { sourceBinId: 'bin-a', locationId: 'loc-1', takeQuantity: 5 },
        { sourceBinId: 'fallback-bin', locationId: 'loc-1', takeQuantity: 3 },
      ]);
    });

    it('should allocate entirely from fallback if no bins have stock', () => {
      const allocations = calculatePickAllocations(5, [], fallback);

      expect(allocations).toEqual([
        { sourceBinId: 'fallback-bin', locationId: 'loc-1', takeQuantity: 5 },
      ]);
    });

    it('should skip empty or zero-quantity bins', () => {
      const availableBins: AvailableBin[] = [
        { binId: 'bin-empty', locationId: 'loc-1', actualQuantity: 0 },
        { binId: 'bin-a', locationId: 'loc-1', actualQuantity: 5 },
      ];
      const allocations = calculatePickAllocations(3, availableBins, fallback);

      expect(allocations).toEqual([
        { sourceBinId: 'bin-a', locationId: 'loc-1', takeQuantity: 3 },
      ]);
    });

    it('should throw BadRequestException if fallback is needed but not provided', () => {
      expect(() => calculatePickAllocations(5, [], null)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('Negative Deltas (Un-Picking Items)', () => {
    it('should allocate directly to fallback bin as a negative take (push)', () => {
      // Un-picking 3 items
      const allocations = calculatePickAllocations(-3, [], fallback);

      expect(allocations).toEqual([
        { sourceBinId: 'fallback-bin', locationId: 'loc-1', takeQuantity: -3 },
      ]);
    });

    it('should throw BadRequestException for unpicking if fallback missing', () => {
      expect(() => calculatePickAllocations(-2, [], null)).toThrow(
        BadRequestException,
      );
    });
  });
});
