import { NextRequest, NextResponse } from 'next/server';
import * as api from '@herobm/sdk';

export async function GET(request: NextRequest) {
  try {
    const res = await api.invoiceDetailControllerGetPurchaseInvoicesGlobal({ vendorId: 'cde72eeb-028f-4c93-b720-8263e977367f', balanceStatus: 'unpaid', days: '0' });
    return NextResponse.json({
      isArray: Array.isArray(res),
      resKeys: Object.keys(res as any),
      dataIsArray: Array.isArray((res as any).data),
      dataKeys: (res as any).data ? Object.keys((res as any).data) : null,
      resFull: res
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, status: err.status, data: err.data }, { status: 500 });
  }
}
