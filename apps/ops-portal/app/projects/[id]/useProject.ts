'use client';

import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';
import {
  getErrorMessage,
  PROJECT_STATE,
  PROJECT_BILLING_TYPE,
  ProjectState,
} from '@herobm/shared';

export interface InventoryBin {
  binId: string;
  binNumber: string;
  binType: string;
  zoneId?: string;
  zoneCode?: string;
}

export interface ProjectResource {
  resourceId: string;
  resourceNumber?: string;
  resourceCode?: string;
  name: string;
  resourceType: string;
  baseUom: string;
  directUnitCost: string | number;
  unitPrice: string | number;
  isActive?: boolean | null;
  serviceProductId?: string | null;
  serviceProduct?: {
    productId?: string;
    productNumber?: string;
    name?: string;
  } | null;
}

export function useProject(projectId: string) {
  const [profitability, setProfitability] = useState<api.ProjectProfitabilityResponseDto | null>(null);
  const [allResources, setAllResources] = useState<ProjectResource[]>([]);
  const [assignedResources, setAssignedResources] = useState<api.ProjectResourceAssignmentResponseDto[]>([]);
  const [invoices, setInvoices] = useState<api.SalesInvoiceResponseDto[]>([]);
  const [users, setUsers] = useState<api.UserResponseDto[]>([]);
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchFn = useCallback(async (id: string) => {
    const [projRes, profRes, resRes, usersRes, assignedRes, invoicesRes, termsRes] = await Promise.all([
      api.projectsControllerFindOne(id),
      api.projectsControllerGetProfitability(id).catch(() => ({ data: null })),
      api.projectsControllerFindAllResources().catch(() => ({ data: [] as unknown as api.ProjectResourceResponseDto[] })),
      api.usersControllerFindAll().catch(() => ({ data: [] as unknown as api.UserResponseDto[] })),
      api.projectsControllerFindAssignedResources(id).catch(() => ({ data: [] as unknown as api.ProjectResourceAssignmentResponseDto[] })),
      api.invoiceDetailControllerGetSalesInvoicesGlobal({ projectId: id, days: 0, limit: 100 }).catch(() => ({ data: { data: [] as api.SalesInvoiceResponseDto[] } })),
      api.tradingTermsControllerFindAll().catch(() => ({ data: [] as unknown as api.TradingTermResponseDto[] })),
    ]);

    if (profRes?.data) {
      setProfitability(profRes.data);
    }
    setAllResources(Array.isArray(resRes?.data) ? resRes.data : []);
    setUsers(Array.isArray(usersRes?.data) ? usersRes.data : []);
    setAssignedResources(Array.isArray(assignedRes?.data) ? assignedRes.data : []);
    setTradingTerms(Array.isArray(termsRes?.data) ? termsRes.data : []);

    const rawInv = invoicesRes?.data;
    const invList = Array.isArray(rawInv)
      ? rawInv
      : Array.isArray((rawInv as { data?: api.SalesInvoiceResponseDto[] })?.data)
      ? (rawInv as { data: api.SalesInvoiceResponseDto[] }).data
      : [];
    setInvoices(invList);

    return projRes as unknown as { data: api.ProjectResponseDto };
  }, []);

  const updateFn = useCallback(async (id: string, dto: api.UpdateProjectDto) => {
    return api.projectsControllerUpdate(id, dto) as unknown as Promise<{ data: api.ProjectResponseDto }>;
  }, []);

  const mapEntityToDto = useCallback((e: api.ProjectResponseDto): Required<api.UpdateProjectDto> => {
    return {
      projectNumber: e.projectNumber || '',
      name: e.name || '',
      description: e.description || '',
      customerId: e.customerId || '',
      opportunityId: e.opportunityId || '',
      stage: e.stage || '',
      billingType: (e.billingType as api.UpdateProjectDtoBillingType) || PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
      projectManagerId: e.projectManagerId || '',
      currencyCode: e.currencyCode || '',
      startDate: e.startDate ? new Date(e.startDate).toISOString().slice(0, 10) : '',
      targetEndDate: e.targetEndDate ? new Date(e.targetEndDate).toISOString().slice(0, 10) : '',
      stagingLocationId: e.stagingLocationId || '',
      stagingBinId: e.stagingBinId || '',
      discountPercentage: e.discountPercentage ? Number(e.discountPercentage) : 0,
      tradingTermsId: e.tradingTermsId || '',
      notes: e.notes || '',
      metadata: (e.metadata as api.UpdateProjectDtoMetadata) || {},
    };
  }, []);

  const {
    entity: project,
    setEntity: setProject,
    dto,
    setDto,
    loading,
    saving,
    setSaving,
    isDirty,
    loadEntity: reloadProject,
    updateField,
    saveField,
    handleSave,
  } = useAutoSaveEntity<api.ProjectResponseDto, api.UpdateProjectDto>({
    id: projectId,
    fetchFn,
    updateFn,
    mapEntityToDto,
  });

  const isEditable = Boolean(
    project &&
    project.stateCode !== PROJECT_STATE.CLOSED
  );

  // Transition Project State
  const transitionState = useCallback(async (targetState: ProjectState, reason?: string) => {
    setActionLoading(true);
    try {
      await api.projectsControllerTransitionState(projectId, {
        stateCode: targetState as api.ProjectStateTransitionDtoStateCode,
        reason,
      });
      toast.success(`Project moved to ${targetState.replace(/_/g, ' ').toUpperCase()}`);
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to transition state');
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Create Task
  const createTask = useCallback(async (taskData: api.CreateProjectTaskDto) => {
    setActionLoading(true);
    try {
      await api.projectsControllerCreateTask(projectId, taskData);
      toast.success('Task created successfully');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create task');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Update Task
  const updateTask = useCallback(async (taskId: string, taskData: api.UpdateProjectTaskDto) => {
    try {
      await api.projectsControllerUpdateTask(projectId, taskId, taskData);
      toast.success('Task updated');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update task');
      throw err;
    }
  }, [projectId, reloadProject]);

  // Delete Task
  const deleteTask = useCallback(async (taskId: string) => {
    setActionLoading(true);
    try {
      await api.projectsControllerDeleteTask(projectId, taskId);
      toast.success('Task deleted');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete task');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Create Budget Line
  const createBudgetLine = useCallback(async (budgetData: api.CreateProjectBudgetLineDto) => {
    setActionLoading(true);
    try {
      await api.projectsControllerCreateBudgetLine(projectId, budgetData);
      toast.success('Budget line added');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to add budget line');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Update Budget Line
  const updateBudgetLine = useCallback(async (lineId: string, budgetData: api.UpdateProjectBudgetLineDto) => {
    setActionLoading(true);
    try {
      await api.projectsControllerUpdateBudgetLine(projectId, lineId, budgetData);
      toast.success('Budget line updated');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update budget line');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Delete Budget Line
  const deleteBudgetLine = useCallback(async (lineId: string) => {
    setActionLoading(true);
    try {
      await api.projectsControllerDeleteBudgetLine(projectId, lineId);
      toast.success('Budget line deleted');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete budget line');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Create Resource
  const createResource = useCallback(async (resourceData: api.CreateProjectResourceDto) => {
    setActionLoading(true);
    try {
      await api.projectsControllerCreateResource(resourceData);
      toast.success('Resource profile created');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create resource');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [reloadProject]);

  // Assign Resource to Project Roster
  const assignResourceToProject = useCallback(
    async (resourceData: api.AssignProjectResourceDto) => {
      setActionLoading(true);
      try {
        await api.projectsControllerAssignResource(projectId, resourceData);
        toast.success('Resource assigned to project');
        await reloadProject();
      } catch (err) {
        toast.error(
          getErrorMessage(err) || 'Failed to assign resource to project',
        );
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [projectId, reloadProject],
  );

  // Remove Resource Assignment from Project
  const removeResourceFromProject = useCallback(
    async (resourceId: string) => {
      setActionLoading(true);
      try {
        await api.projectsControllerRemoveResourceAssignment(
          projectId,
          resourceId,
        );
        toast.success('Resource removed from project');
        await reloadProject();
      } catch (err) {
        toast.error(
          getErrorMessage(err) || 'Failed to remove resource from project',
        );
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [projectId, reloadProject],
  );


  // Issue Inventory to Project
  const issueInventory = useCallback(async (issueData: api.IssueInventoryDto) => {
    setActionLoading(true);
    try {
      await api.projectsControllerIssueInventory(projectId, issueData);
      toast.success('Material issued to project successfully');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to issue material');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Return Inventory from Project
  const returnInventory = useCallback(async (returnData: api.ReturnInventoryDto) => {
    setActionLoading(true);
    try {
      await api.projectsControllerReturnInventory(projectId, returnData);
      toast.success('Material returned to inventory successfully');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to return material');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Consume Resource on Project Task
  const consumeResource = useCallback(async (consumeData: api.ConsumeResourceDto) => {
    setActionLoading(true);
    try {
      await api.projectsControllerConsumeResource(projectId, consumeData);
      await reloadProject();
    } catch (err) {
      reportError(err, 'useProject_consumeResource');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Consume Expense on Project Task
  const consumeExpense = useCallback(async (expenseData: api.ConsumeExpenseDto) => {
    setActionLoading(true);
    try {
      const apiCaller = api as unknown as {
        projectsControllerConsumeExpense?: (id: string, data: unknown) => Promise<unknown>;
        projectsControllerConsumeExpenseAlias?: (id: string, data: unknown) => Promise<unknown>;
      };
      if (apiCaller.projectsControllerConsumeExpense) {
        await apiCaller.projectsControllerConsumeExpense(projectId, expenseData);
      } else if (apiCaller.projectsControllerConsumeExpenseAlias) {
        await apiCaller.projectsControllerConsumeExpenseAlias(projectId, expenseData);
      }
      await reloadProject();
    } catch (err) {
      reportError(err, 'useProject_consumeExpense');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Update Project Ledger Entry (Time/Usage or Expense)
  const updateLedgerEntry = useCallback(async (ledgerId: string, ledgerData: api.UpdateProjectLedgerEntryDto) => {
    setActionLoading(true);
    try {
      await api.projectsControllerUpdateLedgerEntry(projectId, ledgerId, ledgerData);
      toast.success('Time entry updated successfully');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update time entry');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Delete Project Ledger Entry (Time/Usage or Expense)
  const deleteLedgerEntry = useCallback(async (ledgerId: string) => {
    setActionLoading(true);
    try {
      await api.projectsControllerDeleteLedgerEntry(projectId, ledgerId);
      toast.success('Time entry deleted successfully');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete time entry');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Set Project Ledger Entry Billable Status
  const setLedgerEntryBillable = useCallback(async (ledgerId: string, isBillable: boolean) => {
    setActionLoading(true);
    try {
      const apiCaller = api as unknown as {
        projectsControllerSetLedgerEntryBillable?: (id: string, ledgerId: string, data: { isBillable: boolean }) => Promise<unknown>;
      };
      if (apiCaller.projectsControllerSetLedgerEntryBillable) {
        await apiCaller.projectsControllerSetLedgerEntryBillable(projectId, ledgerId, { isBillable });
      } else {
        await api.projectsControllerUpdateLedgerEntry(projectId, ledgerId, { isBillable });
      }
      toast.success(isBillable ? 'Marked as billable' : 'Marked as non-billable');
      await reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update billable status');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Bill Project (Create Sales Invoice)
  const billProject = useCallback(async (billingData: api.BillProjectDto) => {
    setActionLoading(true);
    try {
      const res = await api.projectsControllerBillProject(projectId, billingData);
      await reloadProject();
      return res?.data;
    } catch (err) {
      reportError(err, 'useProject_billProject');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [projectId, reloadProject]);

  // Find bins by location
  const loadBins = useCallback(async (locationId: string): Promise<InventoryBin[]> => {
    if (!locationId) return [];
    try {
      const res = await api.inventoryControllerFindBinsByLocation(locationId);
      const raw = res?.data as unknown;
      const list = (Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data || []) as InventoryBin[];
      return list;
    } catch (err) {
      reportError(err, 'useProject_loadBins');
      toast.error(getErrorMessage(err));
      return [];
    }
  }, []);

  return {
    project,
    setProject,
    dto: dto || {},
    setDto,
    loading,
    saving: saving || actionLoading,
    setSaving,
    isDirty,
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
    handleSave,
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
  };
}
