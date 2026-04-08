import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SetupService } from './setup.service';
import {
  CasbinResource,
  CasbinAction,
  CasbinGuard,
} from '../auth/casbin.guard';
import { SetupGuard } from './setup.guard';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { ExecuteSetupDto, TestAbmConnectionDto } from './setup.dto';

@Controller('setup')
@CasbinResource('setup')
@UseGuards(SetupGuard, CasbinGuard, ThrottlerGuard)
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @CasbinAction('read')
  async getStatus() {
    return this.setupService.getStatus();
  }

  @Post('test-abm')
  @CasbinAction('execute')
  async testAbm(@Body() dto: TestAbmConnectionDto) {
    return this.setupService.testAbmConnection(dto);
  }

  @Get('abm-preview')
  @CasbinAction('read')
  async getAbmPreview() {
    return this.setupService.getAbmPreview();
  }

  @Get('coa-presets')
  @CasbinAction('read')
  async getCoaPresets() {
    return this.setupService.getCoaPresets();
  }

  @Get('resume-state')
  @CasbinAction('read')
  async getResumeState() {
    return this.setupService.getResumeState();
  }

  @Post('initialize')
  @CasbinAction('execute')
  async initializeSystem(@Body() dto: ExecuteSetupDto) {
    return this.setupService.initializeSystem(dto);
  }

  @Post('execute-elt')
  @CasbinAction('execute')
  async executeElt(@Body() dto: ExecuteSetupDto) {
    return this.setupService.executeElt(dto);
  }

  @Get('progress/:jobId')
  @CasbinAction('read')
  @SkipThrottle()
  async getProgress(@Param('jobId') jobId: string) {
    return this.setupService.getJobProgress(jobId);
  }

  @Get('validation')
  @CasbinAction('read')
  async getValidation() {
    return this.setupService.getValidation();
  }
}
