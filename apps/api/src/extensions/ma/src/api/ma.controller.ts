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
  CreateProjectFeedbackDto,
  UpdateProjectFeedbackDto,
  ProjectFeedbackResponseDto,
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
} from '@api/auth/casbin.guard';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.CRM)
export class MaController {
  constructor(private readonly maService: MaService) {}

  @Get(':id/feedback')
  @CasbinAction('read')
  @ApiOperation({ summary: 'Get Project Feedback', description: 'Get Project Feedback', operationId: 'maController_getFeedback' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ type: [ProjectFeedbackResponseDto] })
  getFeedback(@Param('id') id: string) {
    return this.maService.getFeedback(id);
  }

  @Post(':id/feedback')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Add Project Feedback', description: 'Add Project Feedback', operationId: 'maController_addFeedback' })
  @ApiParam({ name: 'id', required: true })
  @ApiCreatedResponse({ type: ProjectFeedbackResponseDto })
  addFeedback(@Param('id') id: string, @Body() dto: CreateProjectFeedbackDto) {
    return this.maService.addFeedback(id, dto);
  }

  @Patch(':id/feedback/:feedbackId')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Update Project Feedback', description: 'Update Project Feedback', operationId: 'maController_updateFeedback' })
  @ApiParam({ name: 'id', required: true })
  @ApiParam({ name: 'feedbackId', required: true })
  @ApiOkResponse({ type: ProjectFeedbackResponseDto })
  updateFeedback(
    @Param('id') id: string,
    @Param('feedbackId') feedbackId: string,
    @Body() dto: UpdateProjectFeedbackDto,
  ) {
    return this.maService.updateFeedback(id, feedbackId, dto);
  }
}


