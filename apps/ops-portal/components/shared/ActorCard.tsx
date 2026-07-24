import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import InfoCard from '@/components/shared/InfoCard';
import { Button } from '@/components/shared/Button';
import { getBadgeColor } from '@/lib/utils';

export interface ActorCardProps {
  actor: {
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

export function ActorCard({
  actor,
  roles,
  onEdit,
  onDelete,
  deleteTitle
}: ActorCardProps) {
  const tGlobal = useTranslations();

  return (
    <InfoCard
      title={
        actor.actorId ? (
          <Link href={`/crm/actors/${actor.actorId}`} className="hover:text-[var(--accent)] hover:underline transition-colors">
            {actor.name || tGlobal('common.unnamedActor')}
          </Link>
        ) : (
          actor.name || tGlobal('common.unnamedActor')
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
              className="text-gray-400 hover:text-[var(--accent)] transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
              onClick={onEdit}
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
              title={deleteTitle || "Unlink Actor"}
            >
              {deleteTitle ? <span className="material-symbols-outlined text-[18px]">link_off</span> : <span className="material-symbols-outlined text-[18px]">delete</span>}
            </Button>
          )}
        </div>
      }
    >
      {actor.legalStatus && <div className="text-sm text-gray-600">{actor.legalStatus}</div>}

      {actor.telephone && (
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <span className="material-symbols-outlined text-[14px] text-gray-400">phone</span>
            <a href={`tel:${actor.telephone}`} className="hover:text-[var(--accent)] transition-colors">{actor.telephone}</a>
          </div>
        </div>
      )}
      {actor.email && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-1.5">
          <span className="material-symbols-outlined text-[14px] text-gray-400">mail</span>
          <a href={`mailto:${actor.email}`} className="text-[var(--accent)] hover:underline truncate">
            {actor.email}
          </a>
        </div>
      )}
    </InfoCard>
  );
}
