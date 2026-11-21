import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { SkipCasbin } from '../auth/casbin.guard';
import { Public as InternalPublic } from '../auth/public.decorator';
import { SetupService } from './setup.service';

import { SuccessResponseDto, WebhookPayloadDto } from './dto';
import { PipelineSecretGuard } from './pipeline-secret.guard';

@ApiExcludeController()
@InternalPublic()
@SkipCasbin()
@UseGuards(ThrottlerGuard, PipelineSecretGuard)
@Controller('internal/setup/webhook')
export class SetupWebhookController {
  constructor(private readonly setupService: SetupService) {}

  @SkipCasbin()
  @Post()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiCreatedResponse({
    description: 'Webhook received',
    type: SuccessResponseDto,
  })
  async handleWebhook(@Body() payload: WebhookPayloadDto) {
    await this.setupService.handleWebhook(payload);
    return { success: true };
  }
}
