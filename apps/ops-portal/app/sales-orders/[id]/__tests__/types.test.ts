import { getGstLabel } from '../types';
import type { GstCategory } from '../types';

function makeCategory(overrides: Partial<GstCategory> = {}): GstCategory {
    return {
        gstCategoryId: 'cat-1',
        code: 'GST',
        title: 'GST',
        type: 'standard',
        rate: '10',
        isDefault: false,
        ...overrides,
    };
}

describe('getGstLabel', () => {
    it('formats integer rate without decimals', () => {
        expect(getGstLabel(makeCategory({ title: 'GST', rate: '10' }))).toBe('GST (10%)');
    });

    it('formats fractional rate with decimals', () => {
        expect(getGstLabel(makeCategory({ title: 'GST', rate: '10.5' }))).toBe('GST (10.5%)');
    });

    it('formats zero rate', () => {
        expect(getGstLabel(makeCategory({ title: 'GST Free', rate: '0' }))).toBe('GST Free (0%)');
    });

    it('handles empty rate string as zero', () => {
        expect(getGstLabel(makeCategory({ title: 'GST Free', rate: '' }))).toBe('GST Free (0%)');
    });

    it('uses the category title in the output', () => {
        expect(getGstLabel(makeCategory({ title: 'Export', rate: '0' }))).toBe('Export (0%)');
    });
});
