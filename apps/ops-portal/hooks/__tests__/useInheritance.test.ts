import { renderHook } from '@testing-library/react';
import { useInheritance, useGroup } from '../useInheritance';

describe('useInheritance', () => {
  it('returns nulls when fallback list is empty', () => {
    const { result } = renderHook(() => useInheritance([]));
    expect(result.current.inheritedValue).toBeNull();
    expect(result.current.inheritedSourceLabel).toBeNull();
  });

  it('resolves the first fallback that has a valid value', () => {
    const { result } = renderHook(() =>
      useInheritance([
        { value: '5000', sourceLabel: 'Customer Group' },
        { value: '1000', sourceLabel: 'System Default' },
      ])
    );
    expect(result.current.inheritedValue).toBe('5000');
    expect(result.current.inheritedSourceLabel).toBe('Customer Group');
  });

  it('skips null, undefined, and empty string fallbacks', () => {
    const { result } = renderHook(() =>
      useInheritance([
        { value: null, sourceLabel: 'Group' },
        { value: undefined, sourceLabel: 'Region' },
        { value: '', sourceLabel: 'Tenant' },
        { value: '30_DAYS', sourceLabel: 'System Default' },
      ])
    );
    expect(result.current.inheritedValue).toBe('30_DAYS');
    expect(result.current.inheritedSourceLabel).toBe('System Default');
  });

  it('returns null if all fallbacks are empty or null', () => {
    const { result } = renderHook(() =>
      useInheritance([
        { value: null, sourceLabel: 'Group' },
        { value: '', sourceLabel: 'Default' },
      ])
    );
    expect(result.current.inheritedValue).toBeNull();
    expect(result.current.inheritedSourceLabel).toBeNull();
  });
});

describe('useGroup', () => {
  const groups = [
    { customerGroupId: 'grp-1', name: 'VIP Retail' },
    { id: 'grp-2', name: 'Wholesale' },
    { supplierGroupId: 'grp-3', name: 'Raw Materials' },
    { productGroupId: 'grp-4', name: 'Electronics' },
  ];

  it('returns null when groupId is null or undefined', () => {
    const { result: r1 } = renderHook(() => useGroup(groups, null));
    expect(r1.current).toBeNull();

    const { result: r2 } = renderHook(() => useGroup(groups, undefined));
    expect(r2.current).toBeNull();
  });

  it('finds group by customerGroupId, id, supplierGroupId, or productGroupId', () => {
    const { result: r1 } = renderHook(() => useGroup(groups, 'grp-1'));
    expect(r1.current).toEqual(groups[0]);

    const { result: r2 } = renderHook(() => useGroup(groups, 'grp-2'));
    expect(r2.current).toEqual(groups[1]);

    const { result: r3 } = renderHook(() => useGroup(groups, 'grp-3'));
    expect(r3.current).toEqual(groups[2]);

    const { result: r4 } = renderHook(() => useGroup(groups, 'grp-4'));
    expect(r4.current).toEqual(groups[3]);
  });

  it('returns null when group is not found', () => {
    const { result } = renderHook(() => useGroup(groups, 'non-existent'));
    expect(result.current).toBeNull();
  });
});
