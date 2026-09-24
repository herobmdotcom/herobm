import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsPercentage } from '../common/validators/is-percentage.decorator';
import type {
  ProjectState,
  ProjectTaskState,
  ProjectBillingType,
  ResourceType,
  ProjectLineType,
  ProjectSourceType,
  ProjectLedgerEntryType,
} from '@herobm/shared';
import {
  PROJECT_STATE,
  PROJECT_TASK_STATE,
  PROJECT_BILLING_TYPE,
  RESOURCE_TYPE,
  PROJECT_LINE_TYPE,
  PROJECT_SOURCE_TYPE,
  PROJECT_LEDGER_ENTRY_TYPE,
} from '@herobm/shared';
import { PaginationQuery } from '../common/pagination';

export class CreateProjectDto {
  @ApiPropertyOptional({
    description: 'Custom project code / number (auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  projectNumber?: string;

  @ApiProperty({ description: 'Name of the project' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Detailed project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Target customer ID' })
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Associated CRM Opportunity ID' })
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiPropertyOptional({
    description: 'Delivery stage (e.g. Planning, In Progress)',
  })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiProperty({
    enum: Object.values(PROJECT_BILLING_TYPE),
    description: 'Project billing mechanism',
  })
  @IsEnum(PROJECT_BILLING_TYPE)
  @IsNotEmpty()
  billingType!: ProjectBillingType;

  @ApiPropertyOptional({ description: 'Assigned Project Manager User ID' })
  @IsOptional()
  @IsUUID()
  projectManagerId?: string;

  @ApiProperty({ description: 'Currency code (e.g. AUD, USD)' })
  @IsString()
  @IsNotEmpty()
  currencyCode!: string;

  @ApiPropertyOptional({ description: 'Staging warehouse location ID' })
  @IsOptional()
  @IsUUID()
  stagingLocationId?: string;

  @ApiPropertyOptional({ description: 'Staging warehouse bin ID' })
  @IsOptional()
  @IsUUID()
  stagingBinId?: string;

  @ApiPropertyOptional({ description: 'Project start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Project target end date' })
  @IsOptional()
  @IsDateString()
  targetEndDate?: string;

  @ApiPropertyOptional({ description: 'Internal project notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: Object, description: 'Custom metadata object' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Default project discount percentage' })
  @IsOptional()
  @IsPercentage()
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Trading / Payment terms ID override for the project',
  })
  @IsOptional()
  @IsUUID()
  tradingTermsId?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'Custom project code / number' })
  @IsOptional()
  @IsString()
  projectNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiPropertyOptional({ description: 'Delivery stage' })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({ enum: Object.values(PROJECT_BILLING_TYPE) })
  @IsOptional()
  @IsEnum(PROJECT_BILLING_TYPE)
  billingType?: ProjectBillingType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectManagerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({ description: 'Staging warehouse location ID' })
  @IsOptional()
  @IsUUID()
  stagingLocationId?: string;

  @ApiPropertyOptional({ description: 'Staging warehouse bin ID' })
  @IsOptional()
  @IsUUID()
  stagingBinId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: Object, description: 'Custom metadata object' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Default project discount percentage' })
  @IsOptional()
  @IsPercentage()
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Trading / Payment terms ID override for the project',
  })
  @IsOptional()
  @IsUUID()
  tradingTermsId?: string | null;
}

export class ProjectStateTransitionDto {
  @ApiProperty({
    enum: Object.values(PROJECT_STATE),
    description: 'Target state code',
  })
  @IsEnum(PROJECT_STATE)
  @IsNotEmpty()
  stateCode!: ProjectState;

  @ApiPropertyOptional({ description: 'Reason for transition' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ProjectQueryDto extends PaginationQuery {
  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsUUID()
  declare customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by delivery stage' })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({
    enum: Object.values(PROJECT_STATE),
    description: 'Filter by state code',
  })
  @IsOptional()
  @IsEnum(PROJECT_STATE)
  stateCode?: ProjectState;

  @ApiPropertyOptional({
    enum: Object.values(PROJECT_STATE),
    description: 'Filter by status (alias for stateCode)',
  })
  @IsOptional()
  @IsEnum(PROJECT_STATE)
  status?: ProjectState;

  @ApiPropertyOptional({ description: 'Filter by project manager user ID' })
  @IsOptional()
  @IsUUID()
  projectManagerId?: string;

  @ApiPropertyOptional({ description: 'Filter by CRM opportunity ID' })
  @IsOptional()
  @IsUUID()
  declare opportunityId?: string;
}

export class CreateProjectTaskDto {
  @ApiProperty({ description: 'Task WBS code (e.g. 1.0, 1.1)' })
  @IsString()
  @IsNotEmpty()
  taskCode!: string;

  @ApiProperty({ description: 'Task name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Task description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Parent task ID for hierarchical subtasks',
  })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiPropertyOptional({ description: 'Is milestone trigger' })
  @IsOptional()
  @IsBoolean()
  isMilestone?: boolean;

  @ApiPropertyOptional({ description: 'Is task billable to customer' })
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;
}

export class UpdateProjectTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taskCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiPropertyOptional({ enum: Object.values(PROJECT_TASK_STATE) })
  @IsOptional()
  @IsEnum(PROJECT_TASK_STATE)
  stateCode?: ProjectTaskState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMilestone?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualEndDate?: string;
}

export class ProjectResourceQueryDto {
  @ApiPropertyOptional({ description: 'Search query across name and code' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Object.values(RESOURCE_TYPE) })
  @IsOptional()
  @IsEnum(RESOURCE_TYPE)
  resourceType?: ResourceType;

  @ApiPropertyOptional({
    description: 'Filter by active status: active, archived, or all',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Boolean active filter' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProjectResourceDto {
  @ApiProperty({ description: 'Resource name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: Object.values(RESOURCE_TYPE) })
  @IsEnum(RESOURCE_TYPE)
  @IsNotEmpty()
  resourceType!: ResourceType;

  @ApiPropertyOptional({ description: 'Linked system user ID (for employees)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Linked supplier ID (for external contractors)',
  })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({
    description: 'Default service product SKU for billing',
  })
  @IsOptional()
  @IsUUID()
  serviceProductId?: string;

  @ApiProperty({ description: 'Base unit of measure (e.g. HOUR, DAY)' })
  @IsString()
  @IsNotEmpty()
  baseUom!: string;

  @ApiPropertyOptional({ description: 'Internal unit cost rate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  directUnitCost?: number;

  @ApiProperty({ description: 'Default billing unit price rate' })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Is resource active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProjectResourceDto {
  @ApiPropertyOptional({ description: 'Custom resource code / number' })
  @IsOptional()
  @IsString()
  resourceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: Object.values(RESOURCE_TYPE) })
  @IsOptional()
  @IsEnum(RESOURCE_TYPE)
  resourceType?: ResourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vendorId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceProductId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseUom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  directUnitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignProjectResourceDto {
  @ApiProperty({ description: 'Project Resource ID to assign to the project' })
  @IsUUID()
  @IsNotEmpty()
  resourceId!: string;

  @ApiPropertyOptional({
    description: 'Optional staffing notes or role on project',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProjectBudgetLineDto {
  @ApiProperty({ description: 'Target Project Task ID' })
  @IsUUID()
  @IsNotEmpty()
  projectTaskId!: string;

  @ApiProperty({ enum: Object.values(PROJECT_LINE_TYPE) })
  @IsEnum(PROJECT_LINE_TYPE)
  @IsNotEmpty()
  lineType!: ProjectLineType;

  @ApiPropertyOptional({ description: 'Resource ID (if lineType is resource)' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Product ID (if lineType is item)' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Planned quantity' })
  @IsNumber()
  @Min(0)
  plannedQuantity!: number;

  @ApiProperty({ description: 'Unit cost estimate' })
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiProperty({ description: 'Unit price estimate' })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Override line discount percentage' })
  @IsOptional()
  @IsPercentage()
  discountPercentage?: number;
}

export class UpdateProjectBudgetLineDto {
  @ApiPropertyOptional({ description: 'Target Project Task ID' })
  @IsOptional()
  @IsUUID()
  projectTaskId?: string;

  @ApiPropertyOptional({ enum: Object.values(PROJECT_LINE_TYPE) })
  @IsOptional()
  @IsEnum(PROJECT_LINE_TYPE)
  lineType?: ProjectLineType;

  @ApiPropertyOptional({ description: 'Resource ID (if lineType is resource)' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Product ID (if lineType is item)' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Planned quantity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedQuantity?: number;

  @ApiPropertyOptional({ description: 'Unit cost estimate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Unit price estimate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Override line discount percentage' })
  @IsOptional()
  @IsPercentage()
  discountPercentage?: number;
}

export class IssueInventoryDto {
  @ApiProperty({ description: 'Project Task ID to consume materials on' })
  @IsUUID()
  @IsNotEmpty()
  projectTaskId!: string;

  @ApiProperty({ description: 'Product ID to issue' })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    description:
      'Source warehouse location ID (defaults to project staging location)',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Source warehouse bin ID (defaults to project staging bin)',
  })
  @IsOptional()
  @IsUUID()
  binId?: string;

  @ApiProperty({ description: 'Quantity to issue' })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Override unit cost' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Override unit price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Transaction memo / notes' })
  @IsOptional()
  @IsString()
  memo?: string;

  @ApiPropertyOptional({ description: 'Target Budget Line ID' })
  @IsOptional()
  @IsUUID()
  budgetLineId?: string;

  @ApiPropertyOptional({ description: 'Override line discount percentage' })
  @IsOptional()
  @IsPercentage()
  discountPercentage?: number;
}

export class ReturnInventoryDto {
  @ApiProperty({ description: 'Project Task ID materials are returning from' })
  @IsUUID()
  @IsNotEmpty()
  projectTaskId!: string;

  @ApiProperty({ description: 'Product ID being returned' })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Destination warehouse location ID' })
  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @ApiProperty({ description: 'Destination warehouse bin ID' })
  @IsUUID()
  @IsNotEmpty()
  binId!: string;

  @ApiProperty({ description: 'Quantity to return' })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Override unit cost' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Override unit price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Transaction memo / notes' })
  @IsOptional()
  @IsString()
  memo?: string;
}

export class ConsumeResourceDto {
  @ApiProperty({ description: 'Project Task ID to record resource usage on' })
  @IsUUID()
  @IsNotEmpty()
  projectTaskId!: string;

  @ApiProperty({ description: 'Resource ID being consumed' })
  @IsUUID()
  @IsNotEmpty()
  resourceId!: string;

  @ApiProperty({ description: 'Quantity (hours / units) of resource consumed' })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Override unit cost rate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Override unit billable price rate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Override discount percentage' })
  @IsOptional()
  @IsPercentage()
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Date of resource usage' })
  @IsOptional()
  @IsDateString()
  postingDate?: string;

  @ApiPropertyOptional({ description: 'Work notes / description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Target Budget Line ID' })
  @IsOptional()
  @IsUUID()
  budgetLineId?: string;
}

export class UpdateProjectLedgerEntryDto {
  @ApiPropertyOptional({
    description: 'Project Task ID to reassign usage/ledger entry to',
  })
  @IsOptional()
  @IsUUID()
  projectTaskId?: string;

  @ApiPropertyOptional({ description: 'Resource ID being consumed' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional({
    description: 'Quantity (hours / units) of resource consumed',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Override unit cost rate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Override unit billable price rate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Override discount percentage' })
  @IsOptional()
  @IsPercentage()
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Date of resource usage / posting' })
  @IsOptional()
  @IsDateString()
  postingDate?: string;

  @ApiPropertyOptional({ description: 'Work notes / description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Target Budget Line ID (null to unallocate)',
  })
  @IsOptional()
  @IsUUID()
  budgetLineId?: string | null;

  @ApiPropertyOptional({
    description: 'Whether this ledger entry is billable to customer',
  })
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;
}

export class SetLedgerEntryBillableDto {
  @ApiProperty({
    description: 'Whether this ledger entry is billable to customer',
  })
  @IsBoolean()
  @IsNotEmpty()
  isBillable!: boolean;
}

export class ProjectLedgerQueryDto extends PaginationQuery {
  @ApiPropertyOptional({ description: 'Filter by task ID' })
  @IsOptional()
  @IsUUID()
  projectTaskId?: string;

  @ApiPropertyOptional({ enum: Object.values(PROJECT_LINE_TYPE) })
  @IsOptional()
  @IsEnum(PROJECT_LINE_TYPE)
  lineType?: ProjectLineType;

  @ApiPropertyOptional({ enum: Object.values(PROJECT_LEDGER_ENTRY_TYPE) })
  @IsOptional()
  @IsEnum(PROJECT_LEDGER_ENTRY_TYPE)
  entryType?: ProjectLedgerEntryType;

  @ApiPropertyOptional({ description: 'Filter by billable flag' })
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @ApiPropertyOptional({ description: 'Filter by billed flag' })
  @IsOptional()
  @IsBoolean()
  isBilled?: boolean;

  @ApiPropertyOptional({ description: 'Filter from posting date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to posting date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class ConsumeExpenseDto {
  @ApiProperty({ description: 'Project Task ID to record expense on' })
  @IsUUID()
  @IsNotEmpty()
  projectTaskId!: string;

  @ApiProperty({ description: 'Description of the direct project expense' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ description: 'Quantity (default: 1)', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantity?: number;

  @ApiProperty({ description: 'Unit cost rate of the expense' })
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional({
    description: 'Unit billable price rate (defaults to unitCost)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({
    description: 'Alias for unitPrice (billable unit price rate)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitBillablePrice?: number;

  @ApiPropertyOptional({ description: 'Override discount percentage' })
  @IsOptional()
  @IsPercentage()
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Date of expense posting' })
  @IsOptional()
  @IsDateString()
  postingDate?: string;

  @ApiPropertyOptional({ description: 'Date when the expense occurred' })
  @IsOptional()
  @IsString()
  expenseDate?: string;

  @ApiPropertyOptional({ description: 'Receipt / reference number' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Additional expense notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Source document ID (e.g., invoice ID, receipt ID)',
  })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Target Budget Line ID' })
  @IsOptional()
  @IsUUID()
  budgetLineId?: string;

  @ApiPropertyOptional({
    enum: Object.values(PROJECT_SOURCE_TYPE),
    description: 'Source type (defaults to manual_journal)',
  })
  @IsOptional()
  @IsEnum(PROJECT_SOURCE_TYPE)
  sourceType?: ProjectSourceType;

  @ApiPropertyOptional({ type: Object, description: 'Custom metadata object' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export class ProjectResponseCustomerDto {
  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  customerNumber!: string;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  customerName?: string | null;

  @ApiPropertyOptional()
  currencyCode?: string | null;

  @ApiPropertyOptional()
  tradingTermsId?: string | null;

  @ApiPropertyOptional()
  paymentTerms?: string | null;
}

export class ProjectResponseOpportunityDto {
  @ApiProperty()
  opportunityId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  estimatedValue?: string | null;

  @ApiPropertyOptional()
  currencyCode?: string | null;
}

export class ProjectResponseProjectManagerDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  username!: string;

  @ApiPropertyOptional()
  email?: string | null;
}

export class ProjectResponseDto {
  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  projectNumber!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  customerId!: string;

  @ApiPropertyOptional()
  opportunityId?: string | null;

  @ApiProperty()
  stateCode!: string;

  @ApiPropertyOptional()
  stage?: string | null;

  @ApiProperty()
  billingType!: string;

  @ApiPropertyOptional()
  projectManagerId?: string | null;

  @ApiProperty()
  currencyCode!: string;

  @ApiPropertyOptional()
  stagingLocationId?: string | null;

  @ApiPropertyOptional()
  stagingBinId?: string | null;

  @ApiPropertyOptional()
  startDate?: Date | null;

  @ApiPropertyOptional()
  targetEndDate?: Date | null;

  @ApiPropertyOptional()
  actualEndDate?: Date | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  discountPercentage?: string | null;

  @ApiPropertyOptional()
  tradingTermsId?: string | null;

  @ApiPropertyOptional()
  paymentTerms?: string | null;

  @ApiPropertyOptional()
  createdBy?: string | null;

  @ApiProperty()
  createdOn!: Date;

  @ApiProperty()
  modifiedOn!: Date;

  @ApiPropertyOptional({ type: () => ProjectResponseCustomerDto })
  customer?: ProjectResponseCustomerDto | null;

  @ApiPropertyOptional({ type: () => ProjectResponseOpportunityDto })
  opportunity?: ProjectResponseOpportunityDto | null;

  @ApiPropertyOptional({ type: () => ProjectResponseProjectManagerDto })
  projectManager?: ProjectResponseProjectManagerDto | null;

  @ApiPropertyOptional({ type: () => Object })
  stagingLocation?: { locationId: string; code: string; name: string } | null;

  @ApiPropertyOptional({ type: () => Object })
  stagingBin?: { binId: string; binNumber: string; binType: string } | null;

  @ApiPropertyOptional({ type: () => [ProjectTaskResponseDto] })
  tasks?: ProjectTaskResponseDto[];

  @ApiPropertyOptional({ type: () => [ProjectBudgetLineResponseDto] })
  budgetLines?: ProjectBudgetLineResponseDto[];

  @ApiPropertyOptional({ type: () => [ProjectLedgerEntryResponseDto] })
  ledgerEntries?: ProjectLedgerEntryResponseDto[];

  @ApiPropertyOptional({ type: () => [ProjectNoteResponseDto] })
  projectNotes?: ProjectNoteResponseDto[];

  @ApiPropertyOptional({ type: () => [ProjectStagingInventoryItemDto] })
  stagingInventory?: ProjectStagingInventoryItemDto[];
}

export class ProjectStagingInventoryItemDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  actualQuantity!: number;

  @ApiPropertyOptional()
  baseUom?: string;
}

export class ProjectResourceUserDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  username!: string;

  @ApiPropertyOptional()
  email?: string | null;
}

export class ProjectResourceVendorDto {
  @ApiProperty()
  vendorId!: string;

  @ApiProperty()
  supplierNumber!: string;

  @ApiProperty()
  supplierName!: string;
}

export class ProjectResourceServiceProductDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  name!: string;
}

export class ProjectResourceResponseDto {
  @ApiProperty()
  resourceId!: string;

  @ApiProperty()
  resourceNumber!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  resourceType!: string;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiPropertyOptional()
  vendorId?: string | null;

  @ApiPropertyOptional()
  serviceProductId?: string | null;

  @ApiProperty()
  baseUom!: string;

  @ApiProperty()
  directUnitCost!: string;

  @ApiProperty()
  unitPrice!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional()
  createdOn?: Date | null;

  @ApiPropertyOptional()
  modifiedOn?: Date | null;

  @ApiPropertyOptional({ type: () => ProjectResourceUserDto })
  user?: ProjectResourceUserDto | null;

  @ApiPropertyOptional({ type: () => ProjectResourceVendorDto })
  vendor?: ProjectResourceVendorDto | null;

  @ApiPropertyOptional({ type: () => ProjectResourceServiceProductDto })
  serviceProduct?: ProjectResourceServiceProductDto | null;
}

export class ProjectResourceAssignmentResponseDto {
  @ApiProperty()
  assignmentId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  resourceId!: string;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional()
  createdOn?: Date | null;

  @ApiPropertyOptional()
  createdBy?: string | null;

  @ApiPropertyOptional({ type: () => ProjectResourceResponseDto })
  resource?: ProjectResourceResponseDto | null;

  @ApiPropertyOptional({
    description: 'Total quantity consumed by this resource on this project',
  })
  consumedQuantity?: number;

  @ApiPropertyOptional({
    description: 'Total cost incurred by this resource on this project',
  })
  totalCost?: number;
}

export class ProjectTaskResponseDto {
  @ApiProperty()
  projectTaskId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  taskCode!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional()
  parentTaskId?: string | null;

  @ApiProperty()
  stateCode!: string;

  @ApiProperty()
  isMilestone!: boolean;

  @ApiProperty()
  isBillable!: boolean;

  @ApiPropertyOptional()
  plannedStartDate?: Date | null;

  @ApiPropertyOptional()
  plannedEndDate?: Date | null;

  @ApiPropertyOptional()
  actualStartDate?: Date | null;

  @ApiPropertyOptional()
  actualEndDate?: Date | null;

  @ApiPropertyOptional()
  createdBy?: string | null;

  @ApiPropertyOptional()
  createdOn?: Date | null;

  @ApiPropertyOptional()
  modifiedOn?: Date | null;
}

export class ProjectBudgetLineResponseDto {
  @ApiProperty()
  budgetLineId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  projectTaskId!: string;

  @ApiProperty()
  lineType!: string;

  @ApiPropertyOptional()
  resourceId?: string | null;

  @ApiPropertyOptional()
  productId?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  plannedQuantity!: string;

  @ApiProperty()
  unitCost!: string;

  @ApiProperty()
  totalCost!: string;

  @ApiProperty()
  unitPrice!: string;

  @ApiPropertyOptional()
  discountPercentage?: string | null;

  @ApiProperty()
  totalPrice!: string;

  @ApiPropertyOptional()
  createdOn?: Date | null;

  @ApiPropertyOptional()
  modifiedOn?: Date | null;

  @ApiPropertyOptional({
    description: 'Total actual cost consumed against this budget line',
  })
  actualCost?: number;

  @ApiPropertyOptional({
    description: 'Total actual revenue generated from this budget line',
  })
  actualRevenue?: number;

  @ApiPropertyOptional({
    description: 'Total actual quantity consumed against this budget line',
  })
  actualQuantity?: number;

  @ApiPropertyOptional({
    description: 'Whether actual cost exceeds planned total cost',
  })
  isOverBudget?: boolean;
}

export class ProjectLedgerEntryResponseDto {
  @ApiProperty()
  ledgerId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  projectTaskId!: string;

  @ApiProperty()
  entryType!: string;

  @ApiProperty()
  lineType!: string;

  @ApiProperty()
  sourceType!: string;

  @ApiPropertyOptional()
  sourceId?: string | null;

  @ApiPropertyOptional()
  inventoryEntryId?: string | null;

  @ApiPropertyOptional()
  resourceId?: string | null;

  @ApiPropertyOptional()
  productId?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  unitCostBase!: string;

  @ApiProperty()
  totalCostBase!: string;

  @ApiProperty()
  unitPriceBase!: string;

  @ApiPropertyOptional()
  discountPercentage?: string | null;

  @ApiProperty()
  totalPriceBase!: string;

  @ApiPropertyOptional()
  isBillable?: boolean;

  @ApiProperty()
  isBilled!: boolean;

  @ApiPropertyOptional()
  salesInvoiceLineId?: string | null;

  @ApiPropertyOptional()
  salesInvoiceNumber?: string | null;

  @ApiPropertyOptional()
  salesInvoiceId?: string | null;

  @ApiPropertyOptional()
  budgetLineId?: string | null;

  @ApiProperty()
  postingDate!: Date;

  @ApiProperty()
  createdBy!: string;

  @ApiPropertyOptional()
  createdOn?: Date | null;
}

export class ProjectProfitabilityResponseDto {
  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  totalBudgetCost!: number;

  @ApiProperty()
  totalBudgetPrice!: number;

  @ApiProperty()
  totalActualCost!: number;

  @ApiProperty()
  totalBillablePrice!: number;

  @ApiProperty()
  totalBilledPrice!: number;

  @ApiProperty()
  costVariance!: number;

  @ApiProperty()
  estimatedMarginPercent!: number;

  @ApiProperty()
  actualMarginPercent!: number;

  @ApiProperty()
  laborActualCost!: number;

  @ApiProperty()
  materialActualCost!: number;

  @ApiProperty()
  expenseActualCost!: number;
}

export class CreateProjectNoteDto {
  @ApiProperty({ description: 'Content of the internal note' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class ProjectNoteResponseDto {
  @ApiProperty({ description: 'Unique note ID' })
  @IsUUID()
  noteId!: string;

  @ApiProperty({ description: 'Parent project ID' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({ description: 'Content of the note' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ description: 'User ID of the note creator' })
  @IsOptional()
  @IsString()
  createdById?: string | null;

  @ApiPropertyOptional({
    type: () => ProjectResponseProjectManagerDto,
    description: 'Creator user details',
  })
  createdBy?: ProjectResponseProjectManagerDto | null;

  @ApiProperty({ description: 'Timestamp when note was created' })
  createdOn!: Date;
}

export class EmptyBodyDto {}

export class ProjectSettingsResponseDto {
  @ApiPropertyOptional()
  settingsId?: string;

  @ApiPropertyOptional({ type: Object })
  projectMetadataSchema?: Record<string, unknown> | null;
}

export class UpdateProjectSettingsDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  projectMetadataSchema?: Record<string, unknown> | null;
}

export class BillProjectLineDto {
  @ApiPropertyOptional({ description: 'Target project task ID' })
  @IsOptional()
  @IsUUID()
  projectTaskId?: string;

  @ApiProperty({ description: 'Line description to appear on the invoice' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'Quantity to bill' })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiProperty({ description: 'Unit price to bill' })
  @IsNumber()
  @Min(0)
  pricePerUnit!: number;

  @ApiPropertyOptional({
    description: 'Total line amount (calculated automatically if omitted)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Discount percentage (0-100)' })
  @IsOptional()
  @IsPercentage()
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Tax category ID' })
  @IsOptional()
  @IsUUID()
  taxCategoryId?: string;

  @ApiPropertyOptional({ description: 'Product ID (optional)' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Revenue GL Account ID (optional)' })
  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @ApiPropertyOptional({
    description: 'Linked unbilled project ledger entry ID (for T&M billing)',
  })
  @IsOptional()
  @IsUUID()
  projectLedgerEntryId?: string;
}

export class BillProjectDto {
  @ApiPropertyOptional({ description: 'Invoice date (ISO string)' })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({ description: 'Invoice notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: () => [BillProjectLineDto],
    description: 'Invoice line items to bill',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillProjectLineDto)
  lines!: BillProjectLineDto[];
}

export class ProjectBillingResponseDto {
  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  taxAmount!: string;

  @ApiProperty()
  currencyCode!: string;

  @ApiProperty()
  stateCode!: string;

  @ApiProperty()
  billedCount!: number;
}
