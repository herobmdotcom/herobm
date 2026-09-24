import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

interface AutoSaveConfig<TEntity, TDto> {
  id: string;
  fetchFn: (id: string) => Promise<{ data: TEntity }>;
  updateFn: (id: string, dto: TDto) => Promise<{ data: TEntity }>;
  mapEntityToDto?: (entity: TEntity) => Required<TDto>;
  onRefresh?: (entity: TEntity) => void;
}

export function useAutoSaveEntity<TEntity, TDto>({
  id,
  fetchFn,
  updateFn,
  mapEntityToDto = (e) => Object.assign({}, e) as unknown as Required<TDto>,
  onRefresh,
}: AutoSaveConfig<TEntity, TDto>) {
  const [entity, setEntity] = useState<TEntity | null>(null);
  const [dto, setDto] = useState<TDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const fetchFnRef = useRef(fetchFn);
  const updateFnRef = useRef(updateFn);
  const mapEntityToDtoRef = useRef(mapEntityToDto);
  const onRefreshRef = useRef(onRefresh);
  const dtoRef = useRef(dto);
  const entityRef = useRef(entity);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
    updateFnRef.current = updateFn;
    mapEntityToDtoRef.current = mapEntityToDto;
    onRefreshRef.current = onRefresh;
    dtoRef.current = dto;
    entityRef.current = entity;
  });

  const loadEntity = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchFnRef.current(id);
      setEntity(res.data);
      setDto(mapEntityToDtoRef.current(res.data));
      setIsDirty(false);
      onRefreshRef.current?.(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEntity();
  }, [loadEntity]);

  const updateField = useCallback((field: keyof TDto, value: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic field update on dynamic DTO
    setDto((prev) => (prev ? { ...prev, [field]: value as any } : null));
    setIsDirty(true);
  }, []);

  const saveField = useCallback(
    async (field: keyof TDto, value: unknown) => {
      const currentEntity = entityRef.current;
      const currentDto = dtoRef.current;
      if (!currentEntity || !currentDto) return;

      // Check if changed vs server state (using the mapping)
      const serverValue = mapEntityToDtoRef.current(currentEntity)[field];
      if (value === serverValue || (value === '' && (serverValue === null || serverValue === undefined))) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic field update on dynamic DTO
      const nextDto = { ...currentDto, [field]: value as any };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic field update on dynamic DTO
      setDto((prev) => (prev ? { ...prev, [field]: value as any } : nextDto));
      setSaving(true);

      try {
        const res = await updateFnRef.current(id, nextDto);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Retain old events until reload completes
        setEntity((prevEntity: any) => ({ ...res.data, events: prevEntity?.events }));
        const savedDto = mapEntityToDtoRef.current(res.data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Merge server state with any concurrent local edits
        setDto((prev) => (prev ? { ...savedDto, ...prev, [field]: (savedDto as any)[field] } : savedDto));
        setIsDirty(false);
        toast.success('Saved');

        // Refresh to pull new timeline events
        const refreshedRes = await fetchFnRef.current(id);
        setEntity(refreshedRes.data);
        const refreshedDto = mapEntityToDtoRef.current(refreshedRes.data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Merge refreshed state with any concurrent local edits
        setDto((prev) => (prev ? { ...refreshedDto, ...prev, [field]: (refreshedDto as any)[field] } : refreshedDto));
        onRefreshRef.current?.(refreshedRes.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
        // Rollback only the field that failed to save
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type assertion for indexed rollback access
        const rollbackVal = (mapEntityToDtoRef.current(currentEntity) as any)[field];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic field rollback on dynamic DTO
        setDto((prev) => (prev ? { ...prev, [field]: rollbackVal } : null));
      } finally {
        setSaving(false);
      }
    },
    [id]
  );

  const handleSave = useCallback(async () => {
    const currentEntity = entityRef.current;
    const currentDto = dtoRef.current;
    if (!isDirty || saving || !currentDto || !currentEntity) return;
    setSaving(true);
    try {
      const res = await updateFnRef.current(id, currentDto);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Retain old events until reload completes
      setEntity((prevEntity: any) => ({ ...res.data, events: prevEntity?.events }));
      const savedDto = mapEntityToDtoRef.current(res.data);
      setDto((prev) => (prev ? { ...savedDto, ...prev } : savedDto));
      setIsDirty(false);
      toast.success('Saved');

      // Refresh to pull new timeline events
      const refreshedRes = await fetchFnRef.current(id);
      setEntity(refreshedRes.data);
      const refreshedDto = mapEntityToDtoRef.current(refreshedRes.data);
      setDto((prev) => (prev ? { ...refreshedDto, ...prev } : refreshedDto));
      onRefreshRef.current?.(refreshedRes.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [id, isDirty, saving]);

  return {
    entity,
    setEntity,
    dto,
    setDto,
    loading,
    saving,
    setSaving,
    isDirty,
    setIsDirty,
    loadEntity,
    updateField,
    saveField,
    handleSave,
  };
}
