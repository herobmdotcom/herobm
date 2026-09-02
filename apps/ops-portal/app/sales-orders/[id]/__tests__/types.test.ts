import { getTaxLabel } from '../types';
import type { TaxCategory } from '../types';

function makeCategory(overrides: Partial<TaxCategory> = {}): TaxCategory {
    return {
        taxCategoryId: 'cat-1',
        code: 'GST',
        title: 'GST',
        type: 'standard',
        rate: '10',
        isDefault: false,
        ...overrides,
    };
}

describe('getTaxLabel', () => {
    it('formats integer rate without decimals', () => {
        expect(getTaxLabel(makeCategory({ title: 'GST', rate: '10' }))).toBe('GST (10%)');
    });

    it('formats fractional rate with decimals', () => {
        expect(getTaxLabel(makeCategory({ title: 'GST', rate: '10.5' }))).toBe('GST (10.5%)');
    });

    it('formats zero rate', () => {
        expect(getTaxLabel(makeCategory({ title: 'GST Free', rate: '0' }))).toBe('GST Free (0%)');
    });

    it('handles empty rate string as zero', () => {
        expect(getTaxLabel(makeCategory({ title: 'GST Free', rate: '' }))).toBe('GST Free (0%)');
    });

    it('uses the category title in the output', () => {
        expect(getTaxLabel(makeCategory({ title: 'Export', rate: '0' }))).toBe('Export (0%)');
    });
});
