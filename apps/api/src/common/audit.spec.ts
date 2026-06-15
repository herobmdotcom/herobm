import { calculateAuditTrail, AuditMode } from './audit';
import { CUSTOMER_STATE } from '@herobm/shared';

describe('calculateAuditTrail', () => {
  const existing = {
    name: 'Old Name',
    notes: 'Old Notes',
    status: CUSTOMER_STATE.ACTIVE,
  };

  it('should return no changes when values are identical', () => {
    const dto = { name: 'Old Name' };
    const result = calculateAuditTrail(dto, existing, AuditMode.DIFF);

    expect(result.hasChanges).toBe(false);
    expect(result.changes).toEqual({});
    expect(result.previousValues).toEqual({});
  });

  it('should detect differences in DIFF mode', () => {
    const dto = { name: 'New Name', status: CUSTOMER_STATE.ACTIVE };
    const result = calculateAuditTrail(dto, existing, AuditMode.DIFF);

    expect(result.hasChanges).toBe(true);
    expect(result.changes).toEqual({ name: 'New Name' });
    expect(result.previousValues).toEqual({ name: 'Old Name' });
  });

  it('should log everything in FULL mode regardless of changes', () => {
    const dto = { name: 'Old Name', notes: 'Old Notes' };
    const result = calculateAuditTrail(dto, existing, AuditMode.FULL);

    expect(result.hasChanges).toBe(true);
    expect(result.changes).toEqual({ name: 'Old Name', notes: 'Old Notes' });
    expect(result.previousValues).toEqual({
      name: 'Old Name',
      notes: 'Old Notes',
    });
  });

  it('should normalize null vs undefined vs empty string', () => {
    const record = { field: null };

    expect(
      calculateAuditTrail({ field: '' }, record, AuditMode.DIFF).hasChanges,
    ).toBe(false);
    expect(
      calculateAuditTrail({ field: undefined }, record, AuditMode.DIFF)
        .hasChanges,
    ).toBe(false);

    const record2 = { field: 'value' };
    expect(
      calculateAuditTrail({ field: null }, record2, AuditMode.DIFF).hasChanges,
    ).toBe(true);
  });
});
