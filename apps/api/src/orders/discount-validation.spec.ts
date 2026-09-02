import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOrderLineDto, UpdateOrderLineDto } from './dto';
import {
  CreateDiscountMatrixDto,
  UpdateDiscountMatrixDto,
} from '../pricing/dto';
import {
  CreatePurchaseOrderLineDto,
  UpdatePurchaseOrderLineDto,
} from '../purchase-orders/dto';

describe('Discount Bounds Validation (ADV-165)', () => {
  describe('Sales Order Line DTOs', () => {
    it('accepts valid discount percentages [0, 100]', async () => {
      const validDiscounts = ['0', '10.5', '50', '99.99', '100'];

      for (const disc of validDiscounts) {
        const createDto = plainToInstance(CreateOrderLineDto, {
          quantity: '1',
          pricePerUnit: '100',
          discountPercentage: disc,
        });
        const createErrors = await validate(createDto);
        expect(createErrors.length).toBe(0);

        const updateDto = plainToInstance(UpdateOrderLineDto, {
          discountPercentage: disc,
        });
        const updateErrors = await validate(updateDto);
        expect(updateErrors.length).toBe(0);
      }
    });

    it('rejects discount percentages greater than 100', async () => {
      const invalidDiscounts = ['100.01', '105', '150', '200'];

      for (const disc of invalidDiscounts) {
        const createDto = plainToInstance(CreateOrderLineDto, {
          quantity: '1',
          pricePerUnit: '100',
          discountPercentage: disc,
        });
        const createErrors = await validate(createDto);
        expect(createErrors.length).toBeGreaterThan(0);
        expect(createErrors[0].property).toBe('discountPercentage');

        const updateDto = plainToInstance(UpdateOrderLineDto, {
          discountPercentage: disc,
        });
        const updateErrors = await validate(updateDto);
        expect(updateErrors.length).toBeGreaterThan(0);
        expect(updateErrors[0].property).toBe('discountPercentage');
      }
    });

    it('rejects discount percentages less than 0', async () => {
      const invalidDiscounts = ['-0.01', '-5', '-50', '-100'];

      for (const disc of invalidDiscounts) {
        const createDto = plainToInstance(CreateOrderLineDto, {
          quantity: '1',
          pricePerUnit: '100',
          discountPercentage: disc,
        });
        const createErrors = await validate(createDto);
        expect(createErrors.length).toBeGreaterThan(0);
        expect(createErrors[0].property).toBe('discountPercentage');

        const updateDto = plainToInstance(UpdateOrderLineDto, {
          discountPercentage: disc,
        });
        const updateErrors = await validate(updateDto);
        expect(updateErrors.length).toBeGreaterThan(0);
        expect(updateErrors[0].property).toBe('discountPercentage');
      }
    });
  });

  describe('Discount Matrix DTOs', () => {
    it('validates discountPercentage bounds on discount matrix', async () => {
      const validDto = plainToInstance(CreateDiscountMatrixDto, {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        discountPercentage: '25.0',
      });
      expect(await validate(validDto)).toHaveLength(0);

      const invalidOverDto = plainToInstance(CreateDiscountMatrixDto, {
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        discountPercentage: '120.0',
      });
      const overErrors = await validate(invalidOverDto);
      expect(overErrors.length).toBeGreaterThan(0);
      expect(overErrors[0].property).toBe('discountPercentage');

      const invalidUnderDto = plainToInstance(UpdateDiscountMatrixDto, {
        discountPercentage: '-10',
      });
      const underErrors = await validate(invalidUnderDto);
      expect(underErrors.length).toBeGreaterThan(0);
      expect(underErrors[0].property).toBe('discountPercentage');
    });
  });

  describe('Purchase Order Line DTOs', () => {
    it('validates discountPercentage bounds on purchase order lines', async () => {
      const validDto = plainToInstance(CreatePurchaseOrderLineDto, {
        quantity: '2',
        pricePerUnit: '50',
        discountPercentage: '15',
      });
      expect(await validate(validDto)).toHaveLength(0);

      const invalidOverDto = plainToInstance(CreatePurchaseOrderLineDto, {
        quantity: '2',
        pricePerUnit: '50',
        discountPercentage: '110',
      });
      const overErrors = await validate(invalidOverDto);
      expect(overErrors.length).toBeGreaterThan(0);
      expect(overErrors[0].property).toBe('discountPercentage');

      const invalidUnderDto = plainToInstance(UpdatePurchaseOrderLineDto, {
        discountPercentage: '-5',
      });
      const underErrors = await validate(invalidUnderDto);
      expect(underErrors.length).toBeGreaterThan(0);
      expect(underErrors[0].property).toBe('discountPercentage');
    });
  });
});
