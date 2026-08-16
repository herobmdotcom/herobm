// security-ignore: dto-validation
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SetupService } from './setup.service';
import { ApiExcludeController, ApiCreatedResponse } from '@nestjs/swagger';
import { SkipCasbin } from '../auth/casbin.guard';
import { Public as InternalPublic } from '../auth/public.decorator';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';

import { WebhookPayloadDto } from './dto';
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
  @ApiCreatedResponse({ description: 'Webhook received', type: Object }) // BYPASS-TYPING-TEST
  async handleWebhook(@Body() payload: WebhookPayloadDto) {
    this.setupService.handleWebhook(payload);
    return { success: true };
  }
}
