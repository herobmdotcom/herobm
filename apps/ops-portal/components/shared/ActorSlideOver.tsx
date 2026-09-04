import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { reportError } from '@/lib/api';
import { Button } from '@/components/shared/Button';
import ActorSelect, { Actor } from '@/components/shared/ActorSelect';
import { useSettings } from '@/components/SettingsProvider';
interface ActorSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId?: string;
  projectId?: string;
  onSaved: () => void;
  editingActor?: {
    actorId: string;
    name: string;
    industry?: string;
    email?: string;
    roles?: string[];
  } | null;
}

export const ActorSlideOver: React.FC<ActorSlideOverProps> = ({
  isOpen,
  onClose,
  opportunityId,
  projectId,
  onSaved,
  editingActor,
}) => {
  const targetOpportunityId = opportunityId || projectId || '';
  const tCommon = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const { app } = useSettings();
  const actorRoles = app?.opportunityActorRoles || app?.projectActorRoles || [];
  
  const [dto, setDto] = useState({
    name: '',
    industry: '',
    email: '',
    actorRoles: [] as string[],
  });

  useEffect(() => {
    if (isOpen) {
      if (editingActor) {
        setDto({
          name: editingActor.name || '',
          industry: editingActor.industry || '',
          email: editingActor.email || '',
          actorRoles: editingActor.roles || [],
        });
        setSelectedActor({
          actorId: editingActor.actorId,
          name: editingActor.name,
          industry: editingActor.industry,
          email: editingActor.email,
        });
      } else {
        setDto({
          name: '',
          industry: '',
          email: '',
          actorRoles: [],
        });
        setSelectedActor(null);
      }
    }
  }, [isOpen, editingActor]);

  const handleSelectActor = (actor: Actor | null) => {
    setSelectedActor(actor);
    if (!actor) {
      setDto({
        name: '',
        industry: '',
        email: '',
        actorRoles: dto.actorRoles,
      });
      return;
    }
    
    setDto({
      name: actor.name || '',
      industry: actor.industry || '',
      email: actor.email || '',
      actorRoles: dto.actorRoles,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dto.name) {
      toast.error('Name is required');
      return;
    }


    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Actor ID compatibility wrapper
      let finalActorId = selectedActor?.actorId || (selectedActor as any)?.id;

      if (typeof finalActorId === 'object' && finalActorId !== null) {
        finalActorId = finalActorId.id || finalActorId.actorId || String(finalActorId);
      }
      if (typeof finalActorId === 'string') {
        finalActorId = finalActorId.replace(/[^0-9a-fA-F-]/g, '').toLowerCase();
      }

      if (finalActorId) {
        // Update the global record identity
        await api.actorsControllerUpdate(finalActorId, {
          name: dto.name,
          industry: dto.industry || undefined,
          email: dto.email || undefined,
        });
      } else {
        // Create new actor
        const newActorResponse = await api.actorsControllerCreate({
          name: dto.name,
          industry: dto.industry || undefined,
          email: dto.email || undefined,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Actor ID compatibility wrapper
        finalActorId = (newActorResponse?.data as any)?.actorId || (newActorResponse?.data as any)?.id || finalActorId;
        if (typeof finalActorId === 'string') finalActorId = finalActorId.trim();
      }

      if (finalActorId) {
        if (typeof finalActorId !== 'string' || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(finalActorId)) {
          reportError(new Error(`DEBUG INVALID finalActorId: ${finalActorId}, selectedActor: ${JSON.stringify(selectedActor)}`), 'ActorSlideOver');
          throw new Error(`Invalid finalActorId (not a UUID): ${JSON.stringify(finalActorId)}. selectedActor: ${JSON.stringify(selectedActor)}`);
        }
        
        if (editingActor && editingActor.actorId === finalActorId) {
          // Update existing link
          await api.opportunitiesControllerUpdateActor(targetOpportunityId, finalActorId, {
            roles: dto.actorRoles.length > 0 ? dto.actorRoles : undefined
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO typing bypass
          } as any);
        } else {
          // Link to opportunity
          await api.opportunitiesControllerAddActor(targetOpportunityId, { 
            actorId: finalActorId, 
            roles: dto.actorRoles.length > 0 ? dto.actorRoles : undefined 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO typing bypass
          } as any);
        }
      }

      toast.success('Actor linked successfully');
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={editingActor ? "Edit Actor Link" : "Link Actor"}
      width="max-w-md"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3 w-full">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            form="actor-form"
            variant="primary"
            className="bg-[var(--accent)] hover:opacity-90 border-none text-white"
            loading={saving}
          >
            {saving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      }
    >
      <form id="actor-form" onSubmit={handleSave} className="flex flex-col gap-5 h-full pb-6">
        
        {!editingActor && (
          <div className="bg-[var(--bg-secondary)] -mx-6 px-6 py-4 border-b border-[var(--border)] mb-2">
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              Search Existing Actor
            </label>
            <ActorSelect
              value={selectedActor?.actorId || null}
              onChange={handleSelectActor}
              placeholder="Type to search..."
              disabled={saving}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="input w-full"
            value={dto.name}
            onChange={(e) => setDto({ ...dto, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            Industry
          </label>
          <input
            type="text"
            className="input w-full"
            value={dto.industry}
            onChange={(e) => setDto({ ...dto, industry: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            Email
          </label>
          <input
            type="email"
            className="input w-full"
            value={dto.email}
            onChange={(e) => setDto({ ...dto, email: e.target.value })}
          />
        </div>

        <div className="mt-2 pt-4 border-t border-gray-100">
          <label className="block text-sm font-medium mb-3 text-[var(--text-muted)]">
            Roles
          </label>
          <div className="flex flex-col gap-3">
            {[...actorRoles].sort((a, b) => Number(a.order) - Number(b.order)).map((r) => (
              <label key={r.value} className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={dto.actorRoles.includes(r.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDto({ ...dto, actorRoles: [...dto.actorRoles, r.value] });
                    } else {
                      setDto({ ...dto, actorRoles: dto.actorRoles.filter(x => x !== r.value) });
                    }
                  }}
                />
                <span className="text-sm capitalize group-hover:text-gray-900 transition-colors">{r.value}</span>
              </label>
            ))}
          </div>
        </div>

      </form>
    </SlideOver>
  );
};
