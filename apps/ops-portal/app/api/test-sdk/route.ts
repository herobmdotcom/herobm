import { NextRequest, NextResponse } from 'next/server';
import * as api from '@herobm/sdk';

export async function GET(request: NextRequest) {
  try {
    const res = await api.invoiceDetailControllerGetPurchaseInvoicesGlobal({ vendorId: 'cde72eeb-028f-4c93-b720-8263e977367f', balanceStatus: 'unpaid', days: 0 });
    return NextResponse.json({
      isArray: Array.isArray(res),
      resKeys: Object.keys(res as Record<string, unknown>),
      dataIsArray: Array.isArray((res as { data?: unknown }).data),
      dataKeys: (res as { data?: unknown }).data ? Object.keys((res as { data?: unknown }).data as Record<string, unknown>) : null,
      resFull: res
    });
  } catch (err: unknown) {
    const error = err as { message?: string, status?: number, data?: unknown };
    return NextResponse.json({ error: error.message, status: error.status, data: error.data }, { status: 500 });
  }
}
