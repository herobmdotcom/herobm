import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { BankFeedsService } from './bank-feeds.service';
import {
  CreateMappingProfileDto,
  CreateReconciliationRuleDto,
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

@ApiTags('GL')
@Controller('gl/bank-feeds')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('gl')
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
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!dto.glAccountId || !dto.profileId)
      throw new BadRequestException('glAccountId and profileId are required');
    return this.bankFeedsService.importCsv(
      file.buffer,
      dto.glAccountId,
      dto.profileId,
    );
  }

  @Get('profiles/:glAccountId')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Mapping Profiles',
    description: 'Retrieves all mapping profiles for a specific GL account.',
  })
  @ApiOkResponse({ type: [MappingProfileResponseDto] })
  async getProfiles(@Param('glAccountId') glAccountId: string) {
    return this.bankFeedsService.getMappingProfiles(glAccountId);
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
}
