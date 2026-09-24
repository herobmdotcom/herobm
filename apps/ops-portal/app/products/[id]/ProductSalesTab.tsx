'use client';

import React from 'react';
import { SalesOrdersDetailGrid } from '@/components/shared/SalesOrdersDetailGrid';

interface ProductSalesTabProps {
  productId: string;
}

export function ProductSalesTab({ productId }: ProductSalesTabProps) {
  return (
    <SalesOrdersDetailGrid
      productId={productId}
      gridKey="product-sales-orders-grid"
      showCustomerColumn
      showProductQuantities
    />
  );
}

export default ProductSalesTab;
