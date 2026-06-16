'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import { useRouter } from 'next/navigation';
import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const colToLetter = (val: string) => {
  if (!val) return '';
  if (/^\d+$/.test(val)) {
    let index = parseInt(val, 10);
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }
  return val;
};

export default function ProfilesPage() {
  const router = useRouter();
  const t = useTranslations('admin.reconciliations');
  useDocumentTitle('Import Profiles');

  const [profiles, setProfiles] = useState<api.MappingProfileResponseDto[]>([]);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const res = await api.bankFeedsControllerGetProfiles();
      const normalizedData = (res.data || []).map(p => ({
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
    }
  };

  const handleSave = async (row: api.MappingProfileResponseDto, isNew: boolean) => {
    try {
      if (isNew) {
        await api.bankFeedsControllerCreateProfile({
          name: row.name,
          dateColumn: row.dateColumn,
          amountColumn: row.amountColumn || undefined,
          debitColumn: row.debitColumn || undefined,
          creditColumn: row.creditColumn || undefined,
          descriptionColumn: row.descriptionColumn,
          typeColumn: row.typeColumn || undefined,
          payeeColumn: row.payeeColumn || undefined,
          referenceColumn: row.referenceColumn || undefined,
          headerRows: Number(row.headerRows || 1),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        } as any);
        toast.success('Profile created');
      } else {
        await api.bankFeedsControllerUpdateProfile(row.profileId, {
          name: row.name,
          dateColumn: row.dateColumn,
          amountColumn: row.amountColumn || undefined,
          debitColumn: row.debitColumn || undefined,
          creditColumn: row.creditColumn || undefined,
          descriptionColumn: row.descriptionColumn,
          typeColumn: row.typeColumn || undefined,
          payeeColumn: row.payeeColumn || undefined,
          referenceColumn: row.referenceColumn || undefined,
          headerRows: Number(row.headerRows || 1),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        } as any);
        toast.success('Profile updated');
      }
      await loadProfiles();
    } catch (err) {
      toast.error(getErrorMessage(err));
      throw err; // Let InlineSettingsTable know it failed
    }
  };

  const handleDelete = async (row: api.MappingProfileResponseDto) => {
    if (!confirm('Are you sure you want to delete this profile?')) return Promise.reject();
    try {
      await api.bankFeedsControllerDeleteProfile(row.profileId);
      toast.success('Profile deleted');
      await loadProfiles();
    } catch (err) {
      toast.error(getErrorMessage(err));
      throw err;
    }
  };

  const handleAdd = () => {
    return {
      profileId: 'new',
      name: 'New Profile',
      dateColumn: 'A',
      descriptionColumn: 'B',
      amountColumn: '',
      debitColumn: '',
      creditColumn: '',
      typeColumn: '',
      payeeColumn: '',
      referenceColumn: '',
      headerRows: 1,
    } as api.MappingProfileResponseDto;
  };

  const letterOptions = ALPHABET.map(l => ({ value: l, label: l }));

  const validateDuplicateCol = (v: string | undefined | null, row: Partial<api.MappingProfileResponseDto>, key: keyof api.MappingProfileResponseDto) => {
    if (!v && key !== 'referenceColumn' && key !== 'debitColumn' && key !== 'creditColumn' && key !== 'amountColumn' && key !== 'typeColumn' && key !== 'payeeColumn') return 'Required';
    if (!v) return null;
    const columnsToCheck: (keyof api.MappingProfileResponseDto)[] = ['dateColumn', 'amountColumn', 'debitColumn', 'creditColumn', 'descriptionColumn', 'typeColumn', 'payeeColumn', 'referenceColumn'];
    for (const col of columnsToCheck) {
      if (col !== key && row[col] === v) {
        return 'Duplicate';
      }
    }
    return null;
  };

  const columns: InlineTableColumn<api.MappingProfileResponseDto>[] = useMemo(() => [
    {
      key: 'name',
      title: 'Profile Name',
      type: 'text',
      validate: (v) => !v ? 'Required' : null,
    },
    {
      key: 'dateColumn',
      title: 'Date',
      type: 'select',
      options: letterOptions,
      validate: (v, row) => validateDuplicateCol(v, row, 'dateColumn'),
    },
    {
      key: 'descriptionColumn',
      title: 'Description',
      type: 'select',
      options: letterOptions,
      validate: (v, row) => validateDuplicateCol(v, row, 'descriptionColumn'),
    },
    {
      key: 'amountColumn',
      title: 'Amount',
      type: 'select',
      options: letterOptions,
      emptyLabel: 'None',
      validate: (v, row) => validateDuplicateCol(v, row, 'amountColumn') || (!v && !row.debitColumn && !row.creditColumn ? 'Required' : null),
    },
    {
      key: 'debitColumn',
      title: 'Debit',
      type: 'select',
      options: letterOptions,
      emptyLabel: 'None',
      validate: (v, row) => validateDuplicateCol(v, row, 'debitColumn'),
    },
    {
      key: 'creditColumn',
      title: 'Credit',
      type: 'select',
      options: letterOptions,
      emptyLabel: 'None',
      validate: (v, row) => validateDuplicateCol(v, row, 'creditColumn'),
    },
    {
      key: 'referenceColumn',
      title: 'Reference',
      type: 'select',
      options: letterOptions,
      emptyLabel: 'None',
      validate: (v, row) => validateDuplicateCol(v, row, 'referenceColumn'),
    },
    {
      key: 'typeColumn',
      title: 'Type',
      type: 'select',
      options: letterOptions,
      emptyLabel: 'None',
      validate: (v, row) => validateDuplicateCol(v, row, 'typeColumn'),
    },
    {
      key: 'payeeColumn',
      title: 'Payee',
      type: 'select',
      options: letterOptions,
      emptyLabel: 'None',
      validate: (v, row) => validateDuplicateCol(v, row, 'payeeColumn'),
    },
    {
      key: 'headerRows',
      title: 'Header Rows',
      type: 'number',
      width: 120,
      validate: (v) => v === undefined || v === null ? 'Required' : null,
    }
  ], [letterOptions]);

  return (
    <DetailsLayout
      header={<EntityHeader title="Import Profiles" onBack={() => router.push('/reconciliations')} />}
    >
      <div className="flex flex-col h-full overflow-hidden w-full max-w-[1400px] mt-4">
        <div className="card">
          <InlineSettingsTable<api.MappingProfileResponseDto>
            title={<h3 className="section-heading !mb-0 flex items-center gap-2">{t('profiles')}</h3>}
            columns={columns}
            data={profiles}
            rowKey={(r) => r.profileId}
            onSave={handleSave}
            onDelete={handleDelete}
            onAdd={handleAdd}
            addLabel="Add Profile"
            emptyLabel="No profiles defined yet."
          />
        </div>
      </div>
    </DetailsLayout>
  );
}
