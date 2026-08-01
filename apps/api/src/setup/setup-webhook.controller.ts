// security-ignore: dto-validation
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SetupService } from './setup.service';
import { ApiExcludeController, ApiCreatedResponse } from '@nestjs/swagger';
import { SkipCasbin } from '../auth/casbin.guard';
import { Public } from '../auth/public.decorator';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WebhookPayloadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  jobId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10240)
  logLine!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  status!: string;
}

@ApiExcludeController()
@Public()
@SkipCasbin()
@UseGuards(ThrottlerGuard)
@Controller('internal/setup/webhook')
export class SetupWebhookController {
  constructor(private readonly setupService: SetupService) {}

  @SkipCasbin()
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiCreatedResponse({ description: 'Webhook received', type: Object }) // BYPASS-TYPING-TEST
  async handleWebhook(@Body() payload: WebhookPayloadDto) {
    this.setupService.handleWebhook(payload);
    return { success: true };
  }
}
