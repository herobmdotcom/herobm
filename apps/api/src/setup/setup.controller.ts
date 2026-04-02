import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SkipCasbin } from '../auth/casbin.guard';
import { SetupGuard } from './setup.guard';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { ExecuteSetupDto, TestAbmConnectionDto } from './setup.dto';

@Controller('setup')
@SkipCasbin()
@UseGuards(SetupGuard, ThrottlerGuard)
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @SkipCasbin()
  async getStatus() {
    return this.setupService.getStatus();
  }

  @Post('test-abm')
  @SkipCasbin()
  async testAbm(@Body() dto: TestAbmConnectionDto) {
    return this.setupService.testAbmConnection(dto);
  }

  @Get('abm-preview')
  @SkipCasbin()
  async getAbmPreview() {
    return this.setupService.getAbmPreview();
  }

  @Get('coa-presets')
  @SkipCasbin()
  async getCoaPresets() {
    return this.setupService.getCoaPresets();
  }

  @Post('execute')
  @SkipCasbin()
  async executeSetup(@Body() dto: ExecuteSetupDto) {
    return this.setupService.executeSetup(dto);
  }

  @Get('progress/:jobId')
  @SkipCasbin()
  @SkipThrottle()
  async getProgress(@Param('jobId') jobId: string) {
    return this.setupService.getJobProgress(jobId);
  }

  @Get('validation')
  @SkipCasbin()
  async getValidation() {
    return this.setupService.getValidation();
  }
}
