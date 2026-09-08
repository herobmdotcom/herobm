import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import InfoCard from '@/components/shared/InfoCard';
import { Button } from '@/components/shared/Button';
import { getBadgeColor } from '@/lib/utils';

export interface OrganizationCardProps {
  organization?: {
    organizationId?: string;
    actorId?: string;
    name?: string | null;
    legalStatus?: string | null;
    telephone?: string | null;
    email?: string | null;
  };
  actor?: {
    organizationId?: string;
    actorId?: string;
    name?: string | null;
    legalStatus?: string | null;
    telephone?: string | null;
    email?: string | null;
  };
  roles?: string[];
  onEdit?: () => void;
  onDelete?: () => void;
  deleteTitle?: string;
}

export function OrganizationCard({
  organization,
  roles,
  onEdit,
  onDelete,
  deleteTitle,
}: OrganizationCardProps) {
  const t = useTranslations('common');
  const org = organization || {};
  const orgId = org.organizationId;

  return (
    <InfoCard
      title={
        orgId ? (
          <Link href={`/crm/organizations/${orgId}`} className="hover:text-[var(--accent)] hover:underline transition-colors">
            {org.name || t('unnamedOrganization')}
          </Link>
        ) : (
          org.name || t('unnamedOrganization')
        )
      }
      badges={
        roles && roles.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 ml-2">
            {roles.map((r, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getBadgeColor(r)}`}
              >
                {r}
              </span>
            ))}
          </div>
        ) : null
      }
      headerRight={
        <div className="flex items-center">
          {onEdit && (
            <Button
              variant="ghost"
              type="button"
              className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
              onClick={onEdit}
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              type="button"
              className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
              onClick={onDelete}
              title={deleteTitle || "Unlink Organization"}
            >
              {deleteTitle ? <span className="material-symbols-outlined text-[18px]">link_off</span> : <span className="material-symbols-outlined text-[18px]">delete</span>}
            </Button>
          )}
        </div>
      }
    >
      {org.legalStatus && <div className="text-sm text-[var(--text-muted)]">{org.legalStatus}</div>}

      {org.telephone && (
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <span className="material-symbols-outlined text-[14px] text-[var(--text-muted)]">phone</span>
            <a href={`tel:${org.telephone}`} className="hover:text-[var(--accent)] transition-colors">{org.telephone}</a>
          </div>
        </div>
      )}
      {org.email && (
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5">
          <span className="material-symbols-outlined text-[14px] text-[var(--text-muted)]">mail</span>
          <a href={`mailto:${org.email}`} className="text-[var(--accent)] hover:underline truncate">
            {org.email}
          </a>
        </div>
      )}
    </InfoCard>
  );
}

export const ActorCard = OrganizationCard;
export type ActorCardProps = OrganizationCardProps;
