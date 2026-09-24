import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { ProjectsBillingService } from './projects-billing.service';
import { ProjectsTasksService } from './projects-tasks.service';
import { ProjectsResourcesService } from './projects-resources.service';
import { ProjectsBudgetService } from './projects-budget.service';
import { ProjectsInventoryService } from './projects-inventory.service';
import { ProjectsLedgerService } from './projects-ledger.service';
import { ProjectsNotesService } from './projects-notes.service';
import { ProjectsSettingsService } from './projects-settings.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponseDto,
  ProjectQueryDto,
  ProjectStateTransitionDto,
  CreateProjectTaskDto,
  UpdateProjectTaskDto,
  CreateProjectResourceDto,
  UpdateProjectResourceDto,
  ProjectResourceQueryDto,
  AssignProjectResourceDto,
  ProjectResourceAssignmentResponseDto,
  CreateProjectBudgetLineDto,
  UpdateProjectBudgetLineDto,
  IssueInventoryDto,
  ReturnInventoryDto,
  ConsumeResourceDto,
  ConsumeExpenseDto,
  UpdateProjectLedgerEntryDto,
  SetLedgerEntryBillableDto,
  ProjectLedgerQueryDto,
  ProjectProfitabilityResponseDto,
  ProjectResourceResponseDto,
  ProjectTaskResponseDto,
  ProjectBudgetLineResponseDto,
  ProjectLedgerEntryResponseDto,
  CreateProjectNoteDto,
  ProjectNoteResponseDto,
  EmptyBodyDto,
  ProjectSettingsResponseDto,
  UpdateProjectSettingsDto,
  BillProjectDto,
  ProjectBillingResponseDto,
} from './dto';
import { SalesInvoiceResponseDto } from '../invoices/dto';
import { ApiPaginatedResponse } from '../common/pagination';
import { SystemResource } from '@herobm/shared';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';

@ApiTags('Projects')
@Controller('projects')
@CasbinResource(SystemResource.PROJECTS)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectsBillingService: ProjectsBillingService,
    private readonly projectsTasksService: ProjectsTasksService,
    private readonly projectsResourcesService: ProjectsResourcesService,
    private readonly projectsBudgetService: ProjectsBudgetService,
    private readonly projectsInventoryService: ProjectsInventoryService,
    private readonly projectsLedgerService: ProjectsLedgerService,
    private readonly projectsNotesService: ProjectsNotesService,
    private readonly projectsSettingsService: ProjectsSettingsService,
  ) {}

  @Get('settings')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Project Settings',
    description: 'Retrieve the project domain settings and metadata schema.',
  })
  @ApiOkResponse({ type: ProjectSettingsResponseDto })
  async getSettings() {
    return this.projectsSettingsService.getSettings();
  }

  @Patch('settings')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Project Settings',
    description: 'Update the project domain settings and metadata schema.',
  })
  @ApiBody({ type: UpdateProjectSettingsDto })
  @ApiOkResponse({ type: ProjectSettingsResponseDto })
  async updateSettings(@Body() body: UpdateProjectSettingsDto) {
    return this.projectsSettingsService.updateSettings(body);
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Project',
    description: 'Create a new operational service project header',
  })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  create(@Body() dto: CreateProjectDto, @AuthUser() user: JwtUser) {
    return this.projectsService.createProject(dto, user.username);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get all Projects',
    description: 'List operational projects with pagination and filters',
  })
  @ApiPaginatedResponse(ProjectResponseDto)
  findAll(@Query() query: ProjectQueryDto) {
    return this.projectsService.findAll(query);
  }

  @Get('resources')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get all Project Resources',
    description: 'List labor profiles, contractors, and equipment rates',
  })
  @ApiOkResponse({ type: [ProjectResourceResponseDto] })
  findAllResources(@Query() query?: ProjectResourceQueryDto) {
    return this.projectsResourcesService.findAllResources(query);
  }

  @Get('resources/:id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Project Resource by ID',
    description: 'Retrieve single resource profile with linked entities',
  })
  @ApiOkResponse({ type: ProjectResourceResponseDto })
  findResourceById(@Param('id') id: string) {
    return this.projectsResourcesService.findResourceById(id);
  }

  @Post('resources')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Project Resource',
    description: 'Create a new labor profile, contractor, or equipment rate',
  })
  @ApiCreatedResponse({ type: ProjectResourceResponseDto })
  createResource(
    @Body() dto: CreateProjectResourceDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsResourcesService.createResource(dto, user.username);
  }

  @Patch('resources/:id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Project Resource',
    description: 'Update resource profile, rates, or linked entity assignments',
  })
  @ApiOkResponse({ type: ProjectResourceResponseDto })
  updateResource(
    @Param('id') id: string,
    @Body() dto: UpdateProjectResourceDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsResourcesService.updateResource(id, dto, user.username);
  }

  @Post('resources/:id/archive')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Project Resource',
    description: 'Set resource isActive to false',
  })
  @ApiOkResponse({ type: ProjectResourceResponseDto })
  archiveResource(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsResourcesService.archiveResource(id, user.username);
  }

  @Post('resources/:id/unarchive')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Project Resource',
    description: 'Restore archived resource (setIsActive to true)',
  })
  @ApiOkResponse({ type: ProjectResourceResponseDto })
  unarchiveResource(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsResourcesService.unarchiveResource(id, user.username);
  }

  @Delete('resources/:id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Project Resource',
    description: 'Delete unreferenced project resource',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        resourceId: { type: 'string' },
      },
    },
  })
  deleteResource(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.projectsResourcesService.deleteResource(id, user.username);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Project Details',
    description:
      'Get project by ID including WBS tasks, budget lines, and ledger actuals',
  })
  @ApiOkResponse({ type: ProjectResponseDto })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Project',
    description: 'Update project header details',
  })
  @ApiOkResponse({ type: ProjectResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.updateProject(id, dto, user.username);
  }

  @Post(':id/state')
  @HttpCode(HttpStatus.OK)
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Transition Project State',
    description:
      'Transition project lifecycle state (planning, in_progress, completed, closed)',
  })
  @ApiOkResponse({ type: ProjectResponseDto })
  transitionState(
    @Param('id') id: string,
    @Body() dto: ProjectStateTransitionDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.transitionState(id, dto, user.username);
  }

  @Post(':id/tasks')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Project Task',
    description: 'Add a new WBS task or milestone to the project',
  })
  @ApiCreatedResponse({ type: ProjectTaskResponseDto })
  createTask(
    @Param('id') id: string,
    @Body() dto: CreateProjectTaskDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsTasksService.createTask(id, dto, user.username);
  }

  @Patch(':id/tasks/:taskId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Project Task',
    description: 'Update task details or transition task state',
  })
  @ApiOkResponse({ type: ProjectTaskResponseDto })
  updateTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateProjectTaskDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsTasksService.updateTask(taskId, dto, user.username);
  }

  @Delete(':id/tasks/:taskId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Project Task',
    description: 'Delete an unreferenced WBS task from the project',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        taskId: { type: 'string' },
      },
    },
  })
  deleteTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsTasksService.deleteTask(id, taskId, user.username);
  }

  @Post(':id/budget-lines')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Budget Line',
    description:
      'Add a budgeted labor, material, or expense line to a project task',
  })
  @ApiCreatedResponse({ type: ProjectBudgetLineResponseDto })
  createBudgetLine(
    @Param('id') id: string,
    @Body() dto: CreateProjectBudgetLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsBudgetService.createBudgetLine(id, dto, user.username);
  }

  @Patch(':id/budget-lines/:lineId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Budget Line',
    description: 'Update a project budget line quantity, rates, or description',
  })
  @ApiBody({ type: UpdateProjectBudgetLineDto })
  @ApiOkResponse({ type: ProjectBudgetLineResponseDto })
  updateBudgetLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateProjectBudgetLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsBudgetService.updateBudgetLine(
      id,
      lineId,
      dto,
      user.username,
    );
  }

  @Delete(':id/budget-lines/:lineId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Budget Line',
    description: 'Delete a budget line from the project',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        lineId: { type: 'string' },
      },
    },
  })
  deleteBudgetLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsBudgetService.deleteBudgetLine(
      id,
      lineId,
      user.username,
    );
  }

  @Post(':id/issue-inventory')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Issue Inventory to Project',
    description:
      'Issue physical materials from warehouse bin to a project task',
  })
  @ApiCreatedResponse({ type: ProjectLedgerEntryResponseDto })
  issueInventory(
    @Param('id') id: string,
    @Body() dto: IssueInventoryDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsInventoryService.issueInventoryToProject(
      id,
      dto,
      user.username,
    );
  }

  @Post(':id/return-inventory')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Return Inventory from Project',
    description:
      'Return unused project materials back to warehouse bin with cost credit',
  })
  @ApiCreatedResponse({ type: ProjectLedgerEntryResponseDto })
  returnInventory(
    @Param('id') id: string,
    @Body() dto: ReturnInventoryDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsInventoryService.returnInventoryFromProject(
      id,
      dto,
      user.username,
    );
  }

  @Post(':id/consume-resource')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Consume Resource on Project',
    description:
      'Record actual labor, contractor, or equipment usage against a project task',
  })
  @ApiCreatedResponse({ type: ProjectLedgerEntryResponseDto })
  consumeResource(
    @Param('id') id: string,
    @Body() dto: ConsumeResourceDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsResourcesService.consumeResource(
      id,
      dto,
      user.username,
    );
  }

  @Get(':id/resources/assigned')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Assigned Resources on Project',
    description:
      'List all resources assigned to the project roster with their actual consumption statistics',
  })
  @ApiOkResponse({ type: [ProjectResourceAssignmentResponseDto] })
  findAssignedResources(@Param('id') id: string) {
    return this.projectsResourcesService.findAssignedResources(id);
  }

  @Post(':id/resources/assigned')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Assign Resource to Project',
    description: 'Add a resource to the project staffing roster',
  })
  @ApiCreatedResponse({ type: ProjectResourceAssignmentResponseDto })
  assignResource(
    @Param('id') id: string,
    @Body() dto: AssignProjectResourceDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsResourcesService.assignResourceToProject(
      id,
      dto,
      user.username,
    );
  }

  @Delete(':id/resources/assigned/:resourceId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Resource Assignment from Project',
    description: 'Remove a resource from the project staffing roster',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        unassigned: { type: 'boolean' },
        resourceId: { type: 'string' },
      },
    },
  })
  removeResourceAssignment(
    @Param('id') id: string,
    @Param('resourceId') resourceId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsResourcesService.removeResourceFromProject(
      id,
      resourceId,
      user.username,
    );
  }

  @Post(':id/expenses')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Record Direct Expense on Project',
    description:
      'Record an actual out-of-pocket, permit, lodging, or direct vendor expense against a project task',
  })
  @ApiCreatedResponse({ type: ProjectLedgerEntryResponseDto })
  consumeExpense(
    @Param('id') id: string,
    @Body() dto: ConsumeExpenseDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsLedgerService.consumeExpense(id, dto, user.username);
  }

  @Post(':id/consume-expense')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Consume Expense on Project (Alias)',
    description:
      'Record an actual out-of-pocket, permit, lodging, or direct vendor expense against a project task',
  })
  @ApiCreatedResponse({ type: ProjectLedgerEntryResponseDto })
  consumeExpenseAlias(
    @Param('id') id: string,
    @Body() dto: ConsumeExpenseDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsLedgerService.consumeExpense(id, dto, user.username);
  }

  @Get(':id/ledger-entries')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Project Ledger Entries',
    description:
      'Retrieve paginated subledger entries (material usage, resource hours, expenses, and milestone billings) for a project.',
  })
  @ApiPaginatedResponse(ProjectLedgerEntryResponseDto)
  getLedgerEntries(
    @Param('id') id: string,
    @Query() query: ProjectLedgerQueryDto,
  ) {
    return this.projectsLedgerService.findLedgerEntries(id, query);
  }

  @Patch(':id/ledger-entries/:ledgerId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Project Ledger Entry',
    description:
      'Update an unbilled project ledger entry (time/usage, expense)',
  })
  @ApiBody({ type: UpdateProjectLedgerEntryDto })
  @ApiOkResponse({ type: ProjectLedgerEntryResponseDto })
  updateLedgerEntry(
    @Param('id') id: string,
    @Param('ledgerId') ledgerId: string,
    @Body() dto: UpdateProjectLedgerEntryDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsLedgerService.updateLedgerEntry(
      id,
      ledgerId,
      dto,
      user.username,
    );
  }

  @Patch(':id/ledger-entries/:ledgerId/billable')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Set Project Ledger Entry Billable Status',
    description:
      'Update the billable status of an unbilled ledger entry (mark billable or non-billable)',
  })
  @ApiBody({ type: SetLedgerEntryBillableDto })
  @ApiOkResponse({ type: ProjectLedgerEntryResponseDto })
  setLedgerEntryBillable(
    @Param('id') id: string,
    @Param('ledgerId') ledgerId: string,
    @Body() dto: SetLedgerEntryBillableDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsLedgerService.setLedgerEntryBillable(
      id,
      ledgerId,
      dto.isBillable,
      user.username,
    );
  }

  @Delete(':id/ledger-entries/:ledgerId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Project Ledger Entry',
    description:
      'Delete an unbilled project ledger entry (time/usage, expense)',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        ledgerId: { type: 'string' },
      },
    },
  })
  deleteLedgerEntry(
    @Param('id') id: string,
    @Param('ledgerId') ledgerId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsLedgerService.deleteLedgerEntry(
      id,
      ledgerId,
      user.username,
    );
  }

  @Get(':id/profitability')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Project Profitability',
    description:
      'Calculate real-time budget vs actual cost variance and gross margin',
  })
  @ApiOkResponse({ type: ProjectProfitabilityResponseDto })
  getProfitability(@Param('id') id: string) {
    return this.projectsInventoryService.getProfitability(id);
  }

  @Post(':id/bill')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Bill Project (Generate Sales Invoice)',
    description:
      'Generate a native Sales Invoice for project time & materials, milestones, or progress drawdowns, update project subledger billing status, and post to General Ledger.',
  })
  @ApiBody({ type: BillProjectDto })
  @ApiCreatedResponse({ type: ProjectBillingResponseDto })
  billProject(
    @Param('id') id: string,
    @Body() dto: BillProjectDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsBillingService.billProject(id, dto, user.username);
  }

  @Get(':id/invoices')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Project Invoices',
    description: 'Retrieve all sales invoices generated for this project',
  })
  @ApiOkResponse({ type: [SalesInvoiceResponseDto] })
  getInvoices(@Param('id') id: string) {
    return this.projectsBillingService.getProjectInvoices(id);
  }

  // --- Sub-resources: Notes ---

  @Post(':id/notes')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Project Note',
    description: 'Add an internal chronological note to the project',
  })
  @ApiCreatedResponse({ type: ProjectNoteResponseDto })
  addNote(
    @Param('id') id: string,
    @Body() dto: CreateProjectNoteDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsNotesService.addProjectNote(id, dto, user.userId);
  }

  @Get(':id/notes')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Project Notes',
    description: 'Retrieve all chronological notes for a project',
  })
  @ApiOkResponse({ type: [ProjectNoteResponseDto] })
  getNotes(@Param('id') id: string) {
    return this.projectsNotesService.getProjectNotes(id);
  }

  @Delete(':id/notes/:noteId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Project Note',
    description: 'Delete a project note by ID',
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { success: { type: 'boolean' } } },
  })
  deleteNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsNotesService.deleteProjectNote(id, noteId, user.userId);
  }
}
