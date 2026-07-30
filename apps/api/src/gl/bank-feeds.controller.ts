import { SystemResource } from '@herobm/shared';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Put,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { BankFeedsService } from './bank-feeds.service';
import {
  CreateMappingProfileDto,
  UpdateMappingProfileDto,
  CreateReconciliationRuleDto,
  UpdateReconciliationRuleDto,
  ImportCsvDto,
  MappingProfileResponseDto,
  ReconciliationRuleResponseDto,
  ParseCsvResponseDto,
  ImportCsvResponseDto,
  FileUploadDto,
} from './dto/bank-feeds.dto';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('General Ledger')
@Controller('gl/bank-feeds')
@CasbinResource(SystemResource.GL)
export class BankFeedsController {
  constructor(private readonly bankFeedsService: BankFeedsService) {}

  @Post('parse')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Parse CSV',
    description: 'Parses a CSV file and returns the headers and sample rows.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileUploadDto })
  @ApiCreatedResponse({ type: ParseCsvResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async parseCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.bankFeedsService.parseCsvHeaders(file.buffer);
  }

  @Post('import')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Import CSV',
    description:
      'Imports a CSV file and creates journal entries based on rules.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ImportCsvDto })
  @ApiCreatedResponse({ type: ImportCsvResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportCsvDto,
    @AuthUser() user: JwtUser,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!dto.glAccountId || !dto.profileId)
      throw new BadRequestException('glAccountId and profileId are required');
    return this.bankFeedsService.importCsv(
      file.buffer,
      dto.glAccountId,
      dto.profileId,
      user.username,
    );
  }

  @Get('profiles')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Mapping Profiles',
    description: 'Retrieves all mapping profiles.',
  })
  @ApiOkResponse({ type: [MappingProfileResponseDto] })
  async getProfiles() {
    return this.bankFeedsService.getMappingProfiles();
  }

  @Post('profiles')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Mapping Profile',
    description: 'Creates a new CSV mapping profile.',
  })
  @ApiCreatedResponse({ type: MappingProfileResponseDto })
  async createProfile(@Body() dto: CreateMappingProfileDto) {
    return this.bankFeedsService.createMappingProfile(dto);
  }

  @Put('profiles/:profileId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Mapping Profile',
    description: 'Updates an existing CSV mapping profile.',
  })
  @ApiOkResponse({ type: MappingProfileResponseDto })
  async updateProfile(
    @Param('profileId') profileId: string,
    @Body() dto: UpdateMappingProfileDto,
  ) {
    return this.bankFeedsService.updateMappingProfile(profileId, dto);
  }

  @Delete('profiles/:profileId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Mapping Profile',
    description: 'Deletes a CSV mapping profile.',
  })
  @ApiOkResponse({ type: MappingProfileResponseDto })
  async deleteProfile(@Param('profileId') profileId: string) {
    return this.bankFeedsService.deleteMappingProfile(profileId);
  }

  @Get('rules')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Rules',
    description: 'Retrieves all reconciliation rules.',
  })
  @ApiOkResponse({ type: [ReconciliationRuleResponseDto] })
  async getRules() {
    return this.bankFeedsService.getReconciliationRules();
  }

  @Post('rules')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Rule',
    description: 'Creates a new reconciliation rule.',
  })
  @ApiCreatedResponse({ type: ReconciliationRuleResponseDto })
  async createRule(@Body() dto: CreateReconciliationRuleDto) {
    return this.bankFeedsService.createReconciliationRule(dto);
  }

  @Put('rules/:ruleId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Rule',
    description: 'Updates an existing reconciliation rule.',
  })
  @ApiOkResponse({ type: ReconciliationRuleResponseDto })
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateReconciliationRuleDto,
  ) {
    return this.bankFeedsService.updateReconciliationRule(ruleId, dto);
  }

  @Delete('rules/:ruleId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Rule',
    description: 'Deletes a reconciliation rule.',
  })
  @ApiOkResponse({ type: ReconciliationRuleResponseDto })
  async deleteRule(@Param('ruleId') ruleId: string) {
    return this.bankFeedsService.deleteReconciliationRule(ruleId);
  }
}
