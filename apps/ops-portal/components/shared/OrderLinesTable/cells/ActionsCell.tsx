'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';

interface ActionsCellProps {
  lineIdentifier: string | number;
  onRemoveLine?: (indexOrId: string | number) => void | Promise<void>;
  title?: string;
  isMobile?: boolean;
}

export function ActionsCell({
  lineIdentifier,
  onRemoveLine,
  title,
  isMobile,
}: ActionsCellProps) {
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');

  if (!onRemoveLine) return null;

  return (
    <Button
      variant="danger"
      size="sm"
      onClick={() => onRemoveLine(lineIdentifier)}
      title={title || tSales('buttons.removeLine')}
    >
      <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
      {isMobile ? ` ${tCommon('buttons.remove')}` : null}
    </Button>
  );
}
