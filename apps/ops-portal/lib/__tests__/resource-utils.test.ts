import { resolveContractorUnitCost } from '../resource-utils';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  ...jest.requireActual('@herobm/sdk'),
  suppliersControllerFindByProduct: jest.fn(),
}));

describe('resolveContractorUnitCost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns fallback standard cost if vendorId or serviceProductId is missing', async () => {
    const cost1 = await resolveContractorUnitCost('', 'prod-123', '150.00');
    expect(cost1).toBe('150.00');

    const cost2 = await resolveContractorUnitCost('vendor-123', '', '200.00');
    expect(cost2).toBe('200.00');

    const cost3 = await resolveContractorUnitCost('', '', null);
    expect(cost3).toBeNull();
  });

  it('returns contracted cost price when supplier is linked without discount', async () => {
    (api.suppliersControllerFindByProduct as jest.Mock).mockResolvedValue({
      data: [
        {
          vendorId: 'vendor-123',
          costPrice: '600.00',
          discountPercent: '0',
          supplierPartNumber: 'RR-SERV-SNR',
        },
      ],
    });

    const cost = await resolveContractorUnitCost('vendor-123', 'prod-service-1', '500.00');
    expect(cost).toBe('600.00');
    expect(api.suppliersControllerFindByProduct).toHaveBeenCalledWith('prod-service-1', { limit: 100 });
  });

  it('calculates net cost price when supplier has a discount percentage', async () => {
    (api.suppliersControllerFindByProduct as jest.Mock).mockResolvedValue({
      data: [
        {
          vendorId: 'vendor-rexroth',
          costPrice: '600.00',
          discountPercent: '10', // 10% discount -> $540.00
          supplierPartNumber: 'RR-SERV-SNR',
        },
      ],
    });

    const cost = await resolveContractorUnitCost('vendor-rexroth', 'prod-service-1', '500.00');
    expect(cost).toBe('540.00');
  });

  it('falls back to standard cost when supplier is not in the linked list', async () => {
    (api.suppliersControllerFindByProduct as jest.Mock).mockResolvedValue({
      data: [
        {
          vendorId: 'other-vendor',
          costPrice: '800.00',
        },
      ],
    });

    const cost = await resolveContractorUnitCost('unlinked-vendor', 'prod-service-1', '350.00');
    expect(cost).toBe('350.00');
  });

  it('handles API error gracefully and returns fallback cost', async () => {
    (api.suppliersControllerFindByProduct as jest.Mock).mockRejectedValue(new Error('Network error'));

    const cost = await resolveContractorUnitCost('vendor-123', 'prod-service-1', '300.00');
    expect(cost).toBe('300.00');
  });
});
