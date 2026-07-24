import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { MaService } from './ma.service';
import {
  CreateSellerQualificationDto,
  UpdateSellerQualificationDto,
  SellerQualificationResponseDto,
  CreateBuyerQualificationDto,
  UpdateBuyerQualificationDto,
  BuyerQualificationResponseDto,
  CreateStrategicIntelligenceDto,
  UpdateStrategicIntelligenceDto,
  StrategicIntelligenceResponseDto,
} from './dto';
import { SystemResource } from '@herobm/shared';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../../../../auth/casbin.guard';

@ApiTags('Actors')
@Controller('actors')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.CRM)
export class MaActorsController {
  constructor(private readonly maService: MaService) {}

  // --- Seller Qualifications ---
  @Get(':id/seller-qualifications')
  @CasbinAction('read')
  @ApiOperation({ summary: 'Get Seller Qualifications', operationId: 'maGetSellerQualifications' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: [SellerQualificationResponseDto] })
  getSellerQualifications(@Param('id') id: string) {
    return this.maService.getSellerQualifications(id);
  }

  @Post(':id/seller-qualifications')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Add Seller Qualification', operationId: 'maAddSellerQualification' })
  @ApiParam({ name: 'id', required: true })
  @ApiCreatedResponse({ type: SellerQualificationResponseDto })
  addSellerQualification(@Param('id') id: string, @Body() dto: CreateSellerQualificationDto) {
    return this.maService.addSellerQualification(id, dto);
  }

  @Patch(':id/seller-qualifications/:qualificationId')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Update Seller Qualification', operationId: 'maUpdateSellerQualification' })
  @ApiParam({ name: 'id', required: true })
  @ApiParam({ name: 'qualificationId', required: true })
  @ApiOkResponse({ type: SellerQualificationResponseDto })
  updateSellerQualification(
    @Param('id') id: string,
    @Param('qualificationId') qualificationId: string,
    @Body() dto: UpdateSellerQualificationDto,
  ) {
    return this.maService.updateSellerQualification(id, qualificationId, dto);
  }

  // --- Buyer Qualifications ---
  @Get(':id/buyer-qualifications')
  @CasbinAction('read')
  @ApiOperation({ summary: 'Get Buyer Qualifications', operationId: 'maGetBuyerQualifications' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: [BuyerQualificationResponseDto] })
  getBuyerQualifications(@Param('id') id: string) {
    return this.maService.getBuyerQualifications(id);
  }

  @Post(':id/buyer-qualifications')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Add Buyer Qualification', operationId: 'maAddBuyerQualification' })
  @ApiParam({ name: 'id', required: true })
  @ApiCreatedResponse({ type: BuyerQualificationResponseDto })
  addBuyerQualification(@Param('id') id: string, @Body() dto: CreateBuyerQualificationDto) {
    return this.maService.addBuyerQualification(id, dto);
  }

  @Patch(':id/buyer-qualifications/:qualificationId')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Update Buyer Qualification', operationId: 'maUpdateBuyerQualification' })
  @ApiParam({ name: 'id', required: true })
  @ApiParam({ name: 'qualificationId', required: true })
  @ApiOkResponse({ type: BuyerQualificationResponseDto })
  updateBuyerQualification(
    @Param('id') id: string,
    @Param('qualificationId') qualificationId: string,
    @Body() dto: UpdateBuyerQualificationDto,
  ) {
    return this.maService.updateBuyerQualification(id, qualificationId, dto);
  }

  // --- Strategic Intelligence ---
  @Get(':id/strategic-intelligence')
  @CasbinAction('read')
  @ApiOperation({ summary: 'Get Strategic Intelligence', operationId: 'maGetStrategicIntelligence' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: [StrategicIntelligenceResponseDto] })
  getStrategicIntelligence(@Param('id') id: string) {
    return this.maService.getStrategicIntelligence(id);
  }

  @Post(':id/strategic-intelligence')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Add Strategic Intelligence', operationId: 'maAddStrategicIntelligence' })
  @ApiParam({ name: 'id', required: true })
  @ApiCreatedResponse({ type: StrategicIntelligenceResponseDto })
  addStrategicIntelligence(@Param('id') id: string, @Body() dto: CreateStrategicIntelligenceDto) {
    return this.maService.addStrategicIntelligence(id, dto);
  }

  @Patch(':id/strategic-intelligence/:intelligenceId')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Update Strategic Intelligence', operationId: 'maUpdateStrategicIntelligence' })
  @ApiParam({ name: 'id', required: true })
  @ApiParam({ name: 'intelligenceId', required: true })
  @ApiOkResponse({ type: StrategicIntelligenceResponseDto })
  updateStrategicIntelligence(
    @Param('id') id: string,
    @Param('intelligenceId') intelligenceId: string,
    @Body() dto: UpdateStrategicIntelligenceDto,
  ) {
    return this.maService.updateStrategicIntelligence(id, intelligenceId, dto);
  }
}


