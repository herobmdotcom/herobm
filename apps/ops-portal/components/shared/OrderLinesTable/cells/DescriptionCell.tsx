'use client';

import React from 'react';
import { CUSTOM_LINE_ID, LineType } from '@herobm/shared';
import type { OrderLineItem } from '../types';

interface DescriptionCellProps {
  line: OrderLineItem;
  lineIdentifier: string | number;
  isEditable: boolean;
  allowCatalogDescriptionEdit?: boolean;
  onUpdateLine?: (indexOrId: string | number, field: string, value: unknown) => void | Promise<void>;
}

export function DescriptionCell({
  line,
  lineIdentifier,
  isEditable,
  allowCatalogDescriptionEdit = true,
  onUpdateLine,
}: DescriptionCellProps) {
  const isComment = line.lineType === LineType.COMMENT;
  const isCustom =
    !line.productId ||
    line.productId === CUSTOM_LINE_ID ||
    line.productId === '00000000-0000-0000-0000-000000000000' ||
    line.productNumber === 'SYSTEM-CUSTOM-LINE';

  const canEdit =
    isEditable &&
    (isComment || isCustom || allowCatalogDescriptionEdit);

  if (!canEdit) {
    return <span className="text-xs">{line.productDescription || '—'}</span>;
  }

  const placeholder = isComment
    ? 'Enter comment / note…'
    : isCustom
    ? 'Custom description…'
    : 'Description…';

  // For live API-persisted lines, use defaultValue + onBlur to prevent excessive API calls
  const isPersisted = Boolean(line.salesOrderLineId || line.purchaseOrderLineId);

  if (isPersisted) {
    return (
      <input
        className="input w-full !text-xs h-7 py-1"
        defaultValue={line.productDescription || ''}
        key={`desc-${lineIdentifier}-${line.productDescription || ''}`}
        placeholder={placeholder}
        onBlur={(e) => {
          if (e.target.value !== (line.productDescription || '')) {
            onUpdateLine?.(lineIdentifier, 'productDescription', e.target.value);
          }
        }}
      />
    );
  }

  return (
    <input
      className="input w-full !text-xs h-7 py-1"
      value={line.productDescription || ''}
      placeholder={placeholder}
      onChange={(e) => onUpdateLine?.(lineIdentifier, 'productDescription', e.target.value)}
    />
  );
}
