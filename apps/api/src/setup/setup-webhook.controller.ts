import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SetupService } from './setup.service';
import { ApiExcludeController, ApiCreatedResponse } from '@nestjs/swagger';
import { SkipCasbin } from '../auth/casbin.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiExcludeController()
@SkipCasbin()
@UseGuards(ThrottlerGuard)
@Controller('internal/setup-webhook')
export class SetupWebhookController {
  constructor(private readonly setupService: SetupService) {}

  @SkipCasbin()
  @Post()
  @ApiCreatedResponse({ description: 'Webhook received', type: Object }) // BYPASS-TYPING-TEST
  async handleWebhook(
    @Body() payload: { jobId: string; logLine: string; status: string },
  ) {
    this.setupService.handleWebhook(payload);
    return { success: true };
  }
}
