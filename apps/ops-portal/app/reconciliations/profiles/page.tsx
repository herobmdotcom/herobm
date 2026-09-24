/* eslint-disable i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */
'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import { Button } from '@/components/shared/Button';
import ProfileSlideover, { colToLetter } from './components/ProfileSlideover';

export default function ProfilesPage() {
  const t = useTranslations('admin.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle('Import Profiles');

  const [profiles, setProfiles] = useState<api.MappingProfileResponseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSlideoverOpen, setIsSlideoverOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<api.MappingProfileResponseDto | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const res = await api.bankFeedsControllerGetProfiles();
      const normalizedData = (res.data || []).map((p) => ({
        ...p,
        dateColumn: colToLetter(p.dateColumn),
        amountColumn: p.amountColumn ? colToLetter(p.amountColumn) : '',
        debitColumn: p.debitColumn ? colToLetter(p.debitColumn) : '',
        creditColumn: p.creditColumn ? colToLetter(p.creditColumn) : '',
        descriptionColumn: colToLetter(p.descriptionColumn),
        typeColumn: p.typeColumn ? colToLetter(p.typeColumn) : '',
        payeeColumn: p.payeeColumn ? colToLetter(p.payeeColumn) : '',
        referenceColumn: p.referenceColumn ? colToLetter(p.referenceColumn) : '',
      }));
      setProfiles(normalizedData);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingProfile(null);
    setIsSlideoverOpen(true);
  };

  const handleEdit = (profile: api.MappingProfileResponseDto) => {
    setEditingProfile(profile);
    setIsSlideoverOpen(true);
  };

  const handleDelete = async (profile: api.MappingProfileResponseDto) => {
    if (!confirm(`Are you sure you want to delete profile "${profile.name}"?`)) return;
    try {
      await api.bankFeedsControllerDeleteProfile(profile.profileId);
      toast.success('Profile deleted successfully');
      await loadProfiles();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <DetailsLayout
      header={<EntityHeader title="Import Profiles" />}
    >
      <div className="flex flex-col h-full overflow-hidden w-full max-w-[1400px] mt-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[var(--accent)]">tune</span>
              <span>{t('profiles')}</span>
            </h3>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateNew}
            >
              <span>Add Profile</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="table-lines w-full text-sm">
              <thead>
                <tr>
                  <th>Profile Name</th>
                  <th>Amount Format</th>
                  <th>Date Column</th>
                  <th>Description Column</th>
                  <th>Reference</th>
                  <th>Payee</th>
                  <th>Header Rows</th>
                  <th className="w-[100px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && profiles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-[var(--text-muted)]">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[20px]">
                          progress_activity
                        </span>
                        <span>Loading profiles...</span>
                      </div>
                    </td>
                  </tr>
                ) : profiles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-sm text-[var(--text-muted)]">
                      <span className="material-symbols-outlined text-4xl block mb-2 opacity-40">folder_off</span>
                      <span>No import profiles found</span>
                    </td>
                  </tr>
                ) : (
                  profiles.map((p) => {
                    const isDual = Boolean(
                      (p.debitColumn || p.creditColumn) && !p.amountColumn,
                    );
                    return (
                      <tr key={p.profileId} className="hover:bg-[var(--bg-secondary)]/40 transition-colors">
                        <td className="font-semibold text-[var(--text-primary)]">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">
                              description
                            </span>
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td>
                          {isDual ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-primary)]">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Separate Columns
                              </span>
                              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                                Out: Col {p.debitColumn || '—'} | In: Col {p.creditColumn || '—'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-primary)]">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Single Column (+/-)
                              </span>
                              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                                Col {p.amountColumn || '—'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] font-semibold">
                            Col {p.dateColumn}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] font-semibold">
                            Col {p.descriptionColumn}
                          </span>
                        </td>
                        <td>
                          {p.referenceColumn ? (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                              Col {p.referenceColumn}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] text-xs">—</span>
                          )}
                        </td>
                        <td>
                          {p.payeeColumn ? (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                              Col {p.payeeColumn}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] text-xs">—</span>
                          )}
                        </td>
                        <td>
                          <span className="text-xs text-[var(--text-secondary)] font-mono">
                            {p.headerRows} {p.headerRows === 1 ? (
                              <span className="text-[var(--text-secondary)]">row</span>
                            ) : (
                              <span className="text-[var(--text-secondary)]">rows</span>
                            )}
                          </span>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => handleEdit(p)}
                              title="Edit profile"
                              className="flex items-center justify-center !p-1.5"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </Button>
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => handleDelete(p)}
                              title="Delete profile"
                              className="flex items-center justify-center !p-1.5 hover:!bg-red-50 text-red-500 border-red-500"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Profile Create / Edit Slideover */}
      <ProfileSlideover
        isOpen={isSlideoverOpen}
        onClose={() => {
          setIsSlideoverOpen(false);
          setEditingProfile(null);
        }}
        onSaved={loadProfiles}
        profileToEdit={editingProfile}
      />
    </DetailsLayout>
  );
}
