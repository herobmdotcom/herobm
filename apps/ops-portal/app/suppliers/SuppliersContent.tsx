'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { Button } from '@/components/shared/Button';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

interface UnifiedSupplierRow {
  vendorId: string;
  vendorNumber: string;
  name: string;
  supplierGroupName?: string;
  supplierGroupCode?: string;
  emailAddress1: string;
  telephone1: string;
  address1City: string;
  address1Country: string;
  currencyCode: string;
  stateCode: string;
  isPurchasingBlocked?: boolean;
  groupIsPurchasingBlocked?: boolean;
  isPaymentBlocked?: boolean;
  groupIsPaymentBlocked?: boolean;
}

export default function SuppliersContent() {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');
  const tSuppliers = useTranslations('suppliers');

  const columns = useMemo<ColDef[]>(() => [
    {
      field: 'vendorNumber',
      headerName: tSuppliers('columns.vendorNumber'),
      width: 140,
      pinned: 'left',
    },
    { field: 'name', headerName: tCommon('columns.name'), flex: 1, minWidth: 200 },
    { field: 'supplierGroupName', headerName: tCommon('columns.group'), width: 130 },
    { field: 'address1Line1', headerName: tCommon('columns.address'), width: 180, hide: true },
    { field: 'address1Line2', headerName: tCommon('columns.address2'), width: 150, hide: true },
    { field: 'address1City', headerName: tCommon('columns.city'), width: 130 },
    { field: 'address1StateOrProvince', headerName: tCommon('columns.state'), width: 90, hide: true },
    { field: 'address1PostalCode', headerName: tCommon('columns.postalCode'), width: 110, hide: true },
    { field: 'address1Country', headerName: tCommon('columns.country'), width: 100 },
    { field: 'telephone1', headerName: tCommon('columns.phone'), width: 140 },
    { field: 'fax', headerName: tCommon('columns.fax'), width: 120, hide: true },
    { field: 'emailAddress1', headerName: tCommon('columns.email'), width: 200 },
    { field: 'paymentTerms', headerName: tSuppliers('columns.paymentTerms'), width: 130, hide: true },
    { field: 'currencyCode', headerName: tCommon('columns.currency'), width: 90 },
    { field: 'notes', headerName: tCommon('columns.notes'), width: 150, hide: true },
    {
      field: 'stateCode',
      headerName: tCommon('columns.status'),
      width: 250,
      valueFormatter: (params: import("ag-grid-community").ValueFormatterParams<UnifiedSupplierRow>) => {
        if (!params.value || !params.data) return '';
        
        const s = String(params.value).toLowerCase();
        let stateText = tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.value);
        
        const blocks = [];
        if (params.data.isPurchasingBlocked || params.data.groupIsPurchasingBlocked) {
            blocks.push('Purchasing Blocked');
        }
        if (params.data.isPaymentBlocked || params.data.groupIsPaymentBlocked) {
            blocks.push('Payment Blocked');
        }
        
        if (blocks.length > 0) {
            stateText += ` (${blocks.join(', ')})`;
        }
        return stateText;
      },
    },
    {
      field: 'createdOn',
      headerName: tCommon('columns.created'),
      width: 110,
      hide: true,
      valueFormatter: (params: { value: unknown }) => {
        return formatLocalDate(params.value as string);
      },
    },
    { field: 'productCount', headerName: tSuppliers('columns.productCount'), width: 100, type: 'numericColumn', hide: true },
  ], [tCommon, tStates, tSuppliers]);



  return (
    <DataGrid<UnifiedSupplierRow>
      endpoint="/api/suppliers"
      columns={columns}
      gridKey="suppliers"
      searchPlaceholder={tSuppliers('placeholders.searchSuppliers')}
      exportFileName="suppliers"
      showArchivedToggle
      rowIdField="vendorId"
      rowHref={(row) => `/suppliers/${encodeURIComponent(row.vendorId)}`}
      pageTitle={tSuppliers('title')}
      defaultSortModel={[{ colId: 'vendorNumber', sort: 'asc' }]}
      headerActions={
        <Button asChild variant="primary">
          <Link href="/suppliers/new">
            {tSuppliers('buttons.createSupplier')}
          </Link>
        </Button>
      }
    />
  );
}
