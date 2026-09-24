import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';
import { reportError } from '@/lib/api';

function extractArrayData<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const inner = (payload as { data: unknown }).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

export function useResource(resourceId: string) {
  const t = useTranslations('projects');
  const router = useRouter();

  const [users, setUsers] = useState<api.UserResponseDto[]>([]);
  const [uomDictionary, setUomDictionary] = useState<api.UomResponseDto[]>([]);

  const {
    entity: resource,
    setEntity: setResource,
    dto,
    setDto,
    loading,
    saving,
    setSaving,
    isDirty,
    loadEntity: loadResource,
    updateField,
    saveField,
    handleSave,
  } = useAutoSaveEntity<api.ProjectResourceResponseDto, Partial<api.ProjectResourceResponseDto>>({
    id: resourceId,
    fetchFn: async (id) => api.projectsControllerFindResourceById(id),
    updateFn: async (id, updatedDto) => {
      const payload: api.UpdateProjectResourceDto = {
        resourceNumber: updatedDto.resourceNumber,
        name: updatedDto.name,
        resourceType: updatedDto.resourceType as api.UpdateProjectResourceDto['resourceType'],
        baseUom: updatedDto.baseUom,
        directUnitCost: updatedDto.directUnitCost !== undefined ? Number(updatedDto.directUnitCost) : undefined,
        unitPrice: updatedDto.unitPrice !== undefined ? Number(updatedDto.unitPrice) : undefined,
        isActive: updatedDto.isActive,
        userId: updatedDto.userId ?? (updatedDto.resourceType === 'person' ? null : undefined),
        vendorId: updatedDto.vendorId ?? (updatedDto.resourceType === 'contractor' ? null : undefined),
        serviceProductId: updatedDto.serviceProductId,
      };
      return api.projectsControllerUpdateResource(id, payload);
    },
  });

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [usersRes, uomsRes] = await Promise.all([
          api.usersControllerFindAll(),
          api.uomDictionaryControllerFindAll(),
        ]);
        setUsers(extractArrayData<api.UserResponseDto>(usersRes?.data));
        setUomDictionary(extractArrayData<api.UomResponseDto>(uomsRes?.data));
      } catch (err: unknown) {
        reportError(err, 'useResource:loadReferenceData');
        toast.error(getErrorMessage(err));
      }
    }
    loadReferenceData();
  }, []);

  const archiveResource = async () => {
    if (!resource || saving) return;
    if (!window.confirm(t('resources.confirmArchive', { name: resource.name }))) return;

    setSaving(true);
    try {
      const res = await api.projectsControllerArchiveResource(resourceId, {});
      setResource(res.data);
      setDto((prev) => (prev ? { ...prev, isActive: false } : null));
      toast.success(t('toasts.resourceArchived'));
      await loadResource();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('toasts.failedToArchiveResource'));
    } finally {
      setSaving(false);
    }
  };

  const unarchiveResource = async () => {
    if (!resource || saving) return;
    if (!window.confirm(t('resources.confirmUnarchive', { name: resource.name }))) return;

    setSaving(true);
    try {
      const res = await api.projectsControllerUnarchiveResource(resourceId, {});
      setResource(res.data);
      setDto((prev) => (prev ? { ...prev, isActive: true } : null));
      toast.success(t('toasts.resourceUnarchived'));
      await loadResource();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('toasts.failedToUnarchiveResource'));
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async () => {
    if (!resource || saving) return;
    if (!window.confirm(t('resources.confirmDelete', { name: resource.name }))) return;

    setSaving(true);
    try {
      await api.projectsControllerDeleteResource(resourceId);
      toast.success(t('toasts.resourceDeleted'));
      router.push('/resources');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('toasts.failedToDeleteResource'));
    } finally {
      setSaving(false);
    }
  };

  return {
    resource,
    setResource,
    dto,
    setDto,
    loading,
    saving,
    setSaving,
    isDirty,
    loadResource,
    updateField,
    saveField,
    handleSave,
    users,
    uomDictionary,
    archiveResource,
    unarchiveResource,
    deleteResource,
  };
}
