import React from 'react';
import { useTranslations } from 'next-intl';
import InfoCard from '@/components/shared/InfoCard';
import { Button } from '@/components/shared/Button';
import { getBadgeColor } from '@/lib/utils';

export interface ContactCardProps {
  contact: {
    firstName?: string | null;
    lastName?: string | null;
    jobTitle?: string | null;
    phone?: string | null;
    mobile?: string | null;
    email?: string | null;
  };
  isPrimary?: boolean;
  primaryRoles?: string[];
  roles?: string[];
  onEdit?: () => void;
  onDelete?: () => void;
  deleteTitle?: string;
}



export function ContactCard({
  contact,
  isPrimary = false,
  primaryRoles = [],
  roles = [],
  onEdit,
  onDelete,
  deleteTitle
}: ContactCardProps) {
  const t = useTranslations('customers');
  const tGlobal = useTranslations();

  return (
    <InfoCard
      title={`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed Contact'}
      isPrimary={isPrimary}
      primaryLabel={t("contactManagement.primaryBadge")}
      badges={
        primaryRoles && primaryRoles.length > 0 ? (
          <div className="flex items-center gap-1 ml-2">
            {primaryRoles.map((role, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getBadgeColor(role)}`}
              >
                {role}
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
              className="text-gray-400 hover:text-[var(--accent)] transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
              onClick={onEdit}
              title={t("contactManagement.editContact")}
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              type="button"
              className="text-gray-400 hover:text-red-500 transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
              onClick={onDelete}
              title={deleteTitle || t("contactManagement.deleteContact")}
            >
              {/* eslint-disable-next-line no-restricted-syntax -- Material Symbol icon names */}
              <span className="material-symbols-outlined text-[18px]">{deleteTitle ? 'link_off' : 'delete'}</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="text-sm text-gray-600">{contact.jobTitle || tGlobal("portal.noTitle")}</div>
      

      {(contact.phone || contact.mobile) && (
        <div className="flex flex-col gap-1.5 mt-2">
          {contact.phone && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className="material-symbols-outlined text-[14px] text-gray-400">phone</span>
              <a href={`tel:${contact.phone}`} className="hover:text-[var(--accent)] transition-colors">{contact.phone}</a>
            </div>
          )}
          {contact.mobile && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className="material-symbols-outlined text-[14px] text-gray-400">smartphone</span>
              <a href={`tel:${contact.mobile}`} className="hover:text-[var(--accent)] transition-colors">{contact.mobile}</a>
            </div>
          )}
        </div>
      )}
      {contact.email && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-1.5">
          <span className="material-symbols-outlined text-[14px] text-gray-400">mail</span>
          <a href={`mailto:${contact.email}`} className="text-[var(--accent)] hover:underline truncate">
            {contact.email}
          </a>
        </div>
      )}

      {roles && roles.length > 0 && (
        <div className="text-sm text-gray-600 mt-1.5 pt-1.5 border-t border-gray-100">
          Role: {roles.join(', ')}
        </div>
      )}
    </InfoCard>
  );
}
