'use client';

import React from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/shared/DataTable';

export interface ComponentItem {
  key?: number | string;
  productId: string;
  productNumber: string;
  productDescription: string;
  expectedQuantity: string;
}

export interface InventoryItem {
  productId: string;
  locationId: string;
  locationName?: string;
  quantityAvailable?: string | number;
}

export function getComponentStockWarning(
  productId: string,
  locationId: string | null | undefined,
  expectedQtyStr: string,
  inventoryLevels: InventoryItem[],
) {
  if (!productId || productId === '00000000-0000-0000-0000-000000000000') return null;
  const expectedQty = parseFloat(expectedQtyStr || '0');
  if (expectedQty <= 0) return null;

  const prodInventory = inventoryLevels.filter((i) => i.productId === productId);
  if (prodInventory.length === 0) {
    return {
      type: 'shortage',
      icon: 'warning',
      color: '#dc2626',
      title: 'No inventory recorded for this component',
    };
  }

  const locInventory = prodInventory.find((i) => i.locationId === locationId);
  const locAvail = locInventory ? parseFloat(String(locInventory.quantityAvailable || '0')) : 0;
  const totalAvail = prodInventory.reduce((sum, i) => sum + parseFloat(String(i.quantityAvailable || '0')), 0);

  if (locAvail >= expectedQty) return null;

  if (totalAvail >= expectedQty) {
    return {
      type: 'others',
      icon: 'warning',
      color: '#d97706',
      title: `Insufficient stock at selected location (Local: ${locAvail}, Required: ${expectedQty}. Available at other sites: ${totalAvail})`,
    };
  }

  return {
    type: 'shortage',
    icon: 'warning',
    color: '#dc2626',
    title: `Stock Shortage (Local: ${locAvail}, Required: ${expectedQty})`,
  };
}

interface WorkOrderAvailabilityTabProps {
  locationId?: string | null;
  components: ComponentItem[];
  inventoryData: InventoryItem[];
  loading: boolean;
}

export function WorkOrderAvailabilityTab({
  locationId,
  components,
  inventoryData,
  loading,
}: WorkOrderAvailabilityTabProps) {
  if (loading) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading component inventory availability...
      </div>
    );
  }

  if (!components || components.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No component line items added.
      </div>
    );
  }

  return (
    <DataTable
      data={components}
      keyExtractor={(comp, idx) => comp.productId || idx}
      columns={[
        { header: '#', width: 40 },
        { header: 'Product' },
        { header: 'Required Qty', align: 'right' },
        { header: 'Availability Status' },
        { header: 'Location Avail.', align: 'right' },
        { header: 'Total Avail. (All Sites)', align: 'right' },
      ]}
      renderCustomRow={(comp: ComponentItem, idx: number) => {
        const expectedQty = parseFloat(comp.expectedQuantity || '0');
        const prodInventory = inventoryData.filter((i) => i.productId === comp.productId);
        const locInventory = prodInventory.find((i) => i.locationId === locationId);
        const locAvail = locInventory ? parseFloat(String(locInventory.quantityAvailable || '0')) : 0;
        const totalAvail = prodInventory.reduce(
          (sum, i) => sum + parseFloat(String(i.quantityAvailable || '0')),
          0,
        );

        let statusElement: React.ReactNode;
        if (locAvail >= expectedQty && expectedQty > 0) {
          statusElement = <span className="text-emerald-600 font-medium">In Stock (Local)</span>;
        } else if (totalAvail >= expectedQty && expectedQty > 0) {
          statusElement = <span className="text-amber-600 font-medium">Available at Other Sites</span>;
        } else {
          statusElement = <span className="text-rose-600 font-medium">Stock Shortage</span>;
        }

        return (
          <tr key={comp.productId || idx} className="hover:bg-slate-50/50 transition-colors">
            <td className="text-slate-400 font-mono text-xs">{idx + 1}</td>
            <td>
              <div className="flex flex-col">
                <Link
                  href={`/products/${comp.productId}`}
                  className="font-semibold text-xs text-[var(--accent)] hover:underline"
                >
                  {comp.productNumber}
                </Link>
                <span className="text-xs text-slate-500">{comp.productDescription}</span>
              </div>
            </td>
            <td className="text-right font-medium text-xs tabular-nums">
              {comp.expectedQuantity || '0'}
            </td>
            <td className="text-xs">{statusElement}</td>
            <td
              className={`text-right font-semibold text-xs tabular-nums ${
                locAvail >= expectedQty ? 'text-slate-700' : 'text-rose-600'
              }`}
            >
              {locAvail}
            </td>
            <td className="text-right font-medium text-xs tabular-nums text-slate-600">
              {totalAvail}
            </td>
          </tr>
        );
      }}
    />
  );
}
