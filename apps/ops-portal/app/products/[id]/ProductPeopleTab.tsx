'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { getErrorMessage, PROJECT_RESOURCE_STATE, RESOURCE_TYPE } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import LinkedEntityCard from '@/components/shared/LinkedEntityCard';
import { formatLocalDate } from '@/lib/date';

function extractArrayData<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const inner = (payload as { data: unknown }).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

interface ProductPeopleTabProps {
  productId: string;
  productName: string;
  productNumber: string;
  isEditable: boolean;
}

export function ProductPeopleTab({
  productId,
  productName,
  productNumber,
  isEditable,
}: ProductPeopleTabProps) {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');

  const [members, setMembers] = useState<api.ServiceMemberResponseDto[]>([]);
  const [people, setPeople] = useState<api.ProjectResourceResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [membersRes, peopleRes] = await Promise.all([
        api.productsControllerGetServiceMembers(productId),
        api.projectsControllerFindAllResources({
          resourceType: RESOURCE_TYPE.PERSON,
          status: PROJECT_RESOURCE_STATE.ACTIVE,
        }),
      ]);
      const membersData = extractArrayData<api.ServiceMemberResponseDto>(membersRes?.data);
      const peopleData = extractArrayData<api.ProjectResourceResponseDto>(peopleRes?.data);
      setMembers(membersData);
      setPeople(peopleData);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResourceId) return;

    setIsAssigning(true);
    try {
      await api.productsControllerAddServiceMember(productId, {
        resourceId: selectedResourceId,
      });
      toast.success(tCommon('saved'));
      setSelectedResourceId('');
      setIsModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemove = async (resourceId: string, name: string) => {
    if (!window.confirm(t('people.confirmRemove', { name }))) return;

    try {
      await api.productsControllerRemoveServiceMember(productId, resourceId);
      toast.success(t('people.personRemoved'));
      await loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const availablePeople = people.filter(
    (p) => !members.some((m) => m.resourceId === p.resourceId),
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
        <h3 className="section-heading !mb-0 flex items-center gap-2">
          <span className="material-symbols-outlined">group</span>
          {t('people.title')}
        </h3>
        {isEditable && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            disabled={availablePeople.length === 0}
          >
            {t('people.assignPerson')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--text-muted)]">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-40">person_off</span>
          {t('people.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-4">
          {members.map((m) => {
            const displayName = m.name || m.displayName || m.username || '—';
            return (
              <LinkedEntityCard
                key={m.memberId || m.resourceId}
                iconElement={
                  <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {displayName.slice(0, 2)}
                  </div>
                }
                title={displayName}
                subtitle={[
                  m.resourceNumber ? `Code: ${m.resourceNumber}` : null,
                  m.email || null,
                  m.username && m.username !== displayName ? `@${m.username}` : null,
                  m.createdOn ? `${t('people.assignedOn')}: ${formatLocalDate(String(m.createdOn))}` : null,
                ]}
                actions={
                  isEditable ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 h-7 w-7 p-0"
                      onClick={() => handleRemove(m.resourceId, displayName)}
                      title={tCommon('delete')}
                    >
                      <span className="material-symbols-outlined text-[16px]">person_remove</span>
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}

      {/* Assign Person Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md bg-[var(--surface)] text-[var(--text-primary)]">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              {t('people.assignPerson')}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              {productNumber} — {productName}
            </p>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  {t('people.name')} *
                </label>
                <select
                  className="input w-full text-sm"
                  required
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                >
                  <option value="">{t('people.selectPerson')}</option>
                  {availablePeople.map((p) => (
                    <option key={p.resourceId} value={p.resourceId}>
                      {p.name} ({p.resourceNumber}){p.user ? ` — ${p.user.displayName || p.user.username} (${p.user.email || p.user.username})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-action">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedResourceId('');
                  }}
                  disabled={isAssigning}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!selectedResourceId || isAssigning}
                >
                  {isAssigning ? t('people.assigning') : t('people.assignPerson')}
                </Button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => !isAssigning && setIsModalOpen(false)} />
        </div>
      )}
    </div>
  );
}

