'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import { Button } from '@/components/shared/Button';
import StateBadge from '@/components/StateBadge';
import ProjectStageBadge from '@/components/ProjectStageBadge';
import { ValidState } from '@/types/states';
import {
  PROJECT_STATE,
  ProjectState,
} from '@herobm/shared';

import { useProject } from './useProject';
import { ProjectOverviewTab } from './components/ProjectOverviewTab';
import { ProjectTasksTab } from './components/ProjectTasksTab';
import { ProjectBudgetTab } from './components/ProjectBudgetTab';
import { ProjectMaterialsTab } from './components/ProjectMaterialsTab';
import { ProjectResourcesTab } from './components/ProjectResourcesTab';
import { ProjectLedgerTab } from './components/ProjectLedgerTab';

export default function ProjectDetailClient({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const initialTab = (rawTab === 'tasks' ? 'wbs' : rawTab === 'ledger' ? 'accounts' : rawTab) as
    | 'overview'
    | 'wbs'
    | 'budget'
    | 'materials'
    | 'resources'
    | 'accounts' || 'overview';
  const [activeTab, setActiveTab] = useState<'overview' | 'wbs' | 'budget' | 'materials' | 'resources' | 'accounts'>(
    ['overview', 'wbs', 'budget', 'materials', 'resources', 'accounts'].includes(initialTab) ? initialTab : 'overview'
  );

  const {
    project,
    dto,
    loading,
    saving,
    isEditable,
    profitability,
    allResources,
    assignedResources,
    invoices,
    users,
    tradingTerms,
    reloadProject,
    updateField,
    saveField,
    transitionState,
    createTask,
    updateTask,
    deleteTask,
    createBudgetLine,
    updateBudgetLine,
    deleteBudgetLine,
    createResource,
    assignResourceToProject,
    removeResourceFromProject,
    consumeResource,
    consumeExpense,
    updateLedgerEntry,
    deleteLedgerEntry,
    setLedgerEntryBillable,
    billProject,
    issueInventory,
    returnInventory,
    loadBins,
  } = useProject(projectId);

  useDocumentTitle(project ? `${project.projectNumber} - ${project.name}` : t('title'));

  if (loading && !project) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-[var(--text-muted)]">
        {tCommon('loading')}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <p className="text-sm text-[var(--text-muted)]">{tCommon('noMatchingResults')}</p>
        <Button variant="secondary" onClick={() => router.push('/projects')}>
          {t('backToProjects')}
        </Button>
      </div>
    );
  }

  const tasksList = project.tasks || [];
  const budgetLinesList = project.budgetLines || [];
  const ledgerEntriesList = project.ledgerEntries || [];
  const currency = dto.currencyCode || project.currencyCode || 'USD';

  const visibleSections = [
    {
      id: 'tab-overview',
      label: t('tabs.overview'),
      isSubPage: true,
      isActive: activeTab === 'overview',
      onClick: () => setActiveTab('overview'),
      subtargets: [
        {
          id: 'overview-section',
          label: t('sections.overview'),
          onClick: () => {
            setActiveTab('overview');
            setTimeout(() => document.getElementById('overview-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          },
        },
        {
          id: 'billing-section',
          label: t('sections.billing'),
          onClick: () => {
            setActiveTab('overview');
            setTimeout(() => document.getElementById('billing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          },
        },
        {
          id: 'schedule-section',
          label: t('sections.schedule'),
          onClick: () => {
            setActiveTab('overview');
            setTimeout(() => document.getElementById('schedule-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          },
        },
        {
          id: 'notes-section',
          label: t('sections.notes'),
          onClick: () => {
            setActiveTab('overview');
            setTimeout(() => document.getElementById('notes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          },
        },
        {
          id: 'kpi-section',
          label: t('sections.kpis'),
          onClick: () => {
            setActiveTab('overview');
            setTimeout(() => document.getElementById('kpi-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          },
        },
        {
          id: 'activity-section',
          label: t('sections.activity'),
          onClick: () => {
            setActiveTab('overview');
            setTimeout(() => document.getElementById('activity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          },
        },
      ],
    },
    {
      id: 'tab-wbs',
      label: t('tabs.wbs'),
      isSubPage: true,
      isActive: activeTab === 'wbs',
      onClick: () => setActiveTab('wbs'),
    },
    {
      id: 'tab-budget',
      label: t('tabs.budget'),
      isSubPage: true,
      isActive: activeTab === 'budget',
      onClick: () => setActiveTab('budget'),
    },
    {
      id: 'tab-materials',
      label: t('tabs.materials'),
      isSubPage: true,
      isActive: activeTab === 'materials',
      onClick: () => setActiveTab('materials'),
    },
    {
      id: 'tab-resources',
      label: t('tabs.resources'),
      isSubPage: true,
      isActive: activeTab === 'resources',
      onClick: () => setActiveTab('resources'),
    },
    {
      id: 'tab-accounts',
      label: t('tabs.accounts'),
      isSubPage: true,
      isActive: activeTab === 'accounts',
      onClick: () => setActiveTab('accounts'),
    },
  ];

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={project.name}
          subtitle={project.projectNumber}
          isSaving={saving}
          badges={
            <div className="flex items-center gap-2">
              <StateBadge state={project.stateCode as ValidState} />
              {project.stage && (
                <ProjectStageBadge stage={project.stage} />
              )}
            </div>
          }
          nav={<PageNav sections={visibleSections} />}
          actions={
            <div className="flex items-center gap-2">
              {project.stateCode === PROJECT_STATE.DRAFT && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  onClick={() => transitionState(PROJECT_STATE.ACTIVE as ProjectState)}
                >
                  {t('buttons.activate')}
                </Button>
              )}
              {project.stateCode === PROJECT_STATE.ACTIVE && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  onClick={() => transitionState(PROJECT_STATE.CLOSED as ProjectState)}
                >
                  {t('buttons.close')}
                </Button>
              )}
              {project.stateCode === PROJECT_STATE.CLOSED && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={() => transitionState(PROJECT_STATE.ACTIVE as ProjectState)}
                >
                  {t('buttons.reopen')}
                </Button>
              )}
            </div>
          }
        />
      }
    >
      <div className="pb-12">
        {activeTab === 'overview' && (
          <ProjectOverviewTab
            project={project}
            dto={dto}
            isEditable={isEditable}
            saving={saving}
            profitability={profitability}
            users={users}
            tradingTerms={tradingTerms}
            updateField={updateField}
            saveField={saveField}
            reloadProject={reloadProject}
          />
        )}

        {activeTab === 'wbs' && (
          <ProjectTasksTab
            tasks={tasksList}
            isEditable={isEditable}
            isProjectActive={project?.stateCode === PROJECT_STATE.ACTIVE}
            saving={saving}
            createTask={createTask}
            updateTask={updateTask}
            deleteTask={deleteTask}
          />
        )}

        {activeTab === 'budget' && (
          <ProjectBudgetTab
            budgetLines={budgetLinesList}
            tasks={tasksList}
            ledgerEntries={ledgerEntriesList}
            currency={currency}
            isEditable={isEditable}
            discountPercentage={Number(project?.discountPercentage) || 0}
            createBudgetLine={createBudgetLine}
            updateBudgetLine={updateBudgetLine}
            deleteBudgetLine={deleteBudgetLine}
          />
        )}

        {activeTab === 'materials' && (
          <ProjectMaterialsTab
            projectId={projectId}
            projectNumber={project?.projectNumber}
            projectName={project?.name}
            dto={dto}
            stagingLocationId={project?.stagingLocationId}
            stagingBinId={project?.stagingBinId}
            stagingInventory={project?.stagingInventory}
            budgetLines={budgetLinesList}
            ledgerEntries={ledgerEntriesList}
            tasks={tasksList}
            currency={currency}
            isEditable={isEditable}
            discountPercentage={Number(project?.discountPercentage) || 0}
            loadBins={loadBins}
            issueInventory={issueInventory}
            returnInventory={returnInventory}
            reloadProject={reloadProject}
            updateField={updateField}
            saveField={saveField}
          />
        )}

        {activeTab === 'resources' && (
          <ProjectResourcesTab
            projectId={projectId}
            projectNumber={project?.projectNumber}
            tasks={tasksList}
            resources={allResources}
            assignedResources={assignedResources}
            budgetLines={budgetLinesList}
            ledgerEntries={ledgerEntriesList}
            currency={currency}
            isEditable={isEditable}
            discountPercentage={Number(project?.discountPercentage) || 0}
            createResource={createResource}
            assignResourceToProject={assignResourceToProject}
            removeResourceFromProject={removeResourceFromProject}
            consumeResource={consumeResource}
            createBudgetLine={createBudgetLine}
            updateBudgetLine={updateBudgetLine}
            deleteBudgetLine={deleteBudgetLine}
            updateLedgerEntry={updateLedgerEntry}
            deleteLedgerEntry={deleteLedgerEntry}
            reloadProject={reloadProject}
          />
        )}

        {activeTab === 'accounts' && (
          <ProjectLedgerTab
            projectId={projectId}
            projectNumber={project?.projectNumber}
            projectName={project?.name}
            budgetLines={budgetLinesList}
            ledgerEntries={ledgerEntriesList}
            tasks={tasksList}
            invoices={invoices}
            currency={currency}
            isEditable={isEditable}
            profitability={profitability}
            projectBillingType={project?.billingType}
            paymentTerms={(project as { paymentTerms?: string | null })?.paymentTerms || project?.customer?.paymentTerms || undefined}
            discountPercentage={Number(project?.discountPercentage) || 0}
            consumeExpense={consumeExpense}
            billProject={billProject}
            setLedgerEntryBillable={setLedgerEntryBillable}
            reloadProject={reloadProject}
          />
        )}
      </div>
    </DetailsLayout>
  );
}
