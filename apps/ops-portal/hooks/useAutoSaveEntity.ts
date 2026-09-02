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

  useEffect(() => {
    fetchFnRef.current = fetchFn;
    updateFnRef.current = updateFn;
    mapEntityToDtoRef.current = mapEntityToDto;
    onRefreshRef.current = onRefresh;
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
    setDto((prev) => (prev ? { ...prev, [field]: value } : null));
    setIsDirty(true);
  }, []);

  const saveField = useCallback(
    async (field: keyof TDto, value: unknown) => {
      if (!entity || !dto) return;

      // Check if changed vs server state (using the mapping)
      const serverValue = mapEntityToDtoRef.current(entity)[field];
      if (value === serverValue || (value === '' && (serverValue === null || serverValue === undefined))) return;

      const nextDto = { ...dto, [field]: value };
      setDto(nextDto);
      setSaving(true);

      try {
        const res = await updateFnRef.current(id, nextDto);
        setEntity({ ...res.data, events: (entity as any)?.events }); // Retain old events until reload completes
        setDto(mapEntityToDtoRef.current(res.data));
        setIsDirty(false);
        toast.success('Saved');

        // Refresh to pull new timeline events
        const refreshedRes = await fetchFnRef.current(id);
        setEntity(refreshedRes.data);
        setDto(mapEntityToDtoRef.current(refreshedRes.data));
        onRefreshRef.current?.(refreshedRes.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
        // Rollback
        setDto(mapEntityToDtoRef.current(entity));
      } finally {
        setSaving(false);
      }
    },
    [id, entity, dto]
  );

  const handleSave = useCallback(async () => {
    if (!isDirty || saving || !dto || !entity) return;
    setSaving(true);
    try {
      const res = await updateFnRef.current(id, dto);
      setEntity({ ...res.data, events: (entity as any)?.events });
      setDto(mapEntityToDtoRef.current(res.data));
      setIsDirty(false);
      toast.success('Saved');

      // Refresh to pull new timeline events
      const refreshedRes = await fetchFnRef.current(id);
      setEntity(refreshedRes.data);
      setDto(mapEntityToDtoRef.current(refreshedRes.data));
      onRefreshRef.current?.(refreshedRes.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [id, dto, entity, isDirty, saving]);

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
