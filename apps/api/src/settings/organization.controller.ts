import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../common/config/throttler.config';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { OrganizationService } from './organization.service';
import { StorageService } from '../common/storage/storage.service';
import { CasbinResource, CasbinAction, SkipCasbin } from '../auth/casbin.guard';
import { Public } from '../auth/public.decorator';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { UpdateOrganizationDto, OrganizationResponseDto } from './dto';

@Controller('settings/organization')
@CasbinResource(SystemResource.SETTINGS)
@ApiTags('System')
export class OrganizationController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @ApiOkResponse({ type: OrganizationResponseDto })
  @CasbinAction('read')
  @ApiOperation({ summary: 'get', description: 'get operation' })
  get() {
    return this.orgService.get();
  }

  @Patch()
  @ApiBody({ type: UpdateOrganizationDto })
  @ApiOkResponse({ type: OrganizationResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'update', description: 'update operation' })
  update(@Body() dto: UpdateOrganizationDto, @AuthUser() user: JwtUser) {
    return this.orgService.update(dto, user?.userId || 'system');
  }

  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OrganizationResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  @CasbinAction('write')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload Organization Logo',
    description: 'Upload and set the company logo image (max 5MB).',
  })
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @AuthUser() user: JwtUser,
  ) {
    return this.orgService.uploadLogo(file, user?.username || 'system');
  }

  @Delete('logo')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Organization Logo',
    description: 'Remove the company logo image.',
  })
  @ApiOkResponse({ type: OrganizationResponseDto })
  async removeLogo(@AuthUser() user: JwtUser) {
    return this.orgService.removeLogo(user?.username || 'system');
  }

  @Get('logo')
  @ApiOkResponse({
    description: 'Logo binary content',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @SkipCasbin()
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.DEFAULT })
  @ApiOperation({
    summary: 'Stream Organization Logo',
    description: 'Publicly stream the company logo image.',
  })
  async streamLogo(@Res() res: Response) {
    const org = await this.orgService.get();
    if (!org.logoUrl) {
      throw new NotFoundException('Logo not configured');
    }

    const cleanPath = org.logoUrl
      .replace(/^(\/api)?\/storage\/images\//, '')
      .replace(/^(\/api)?\/products\/images\//, '');

    const { fullPath, exists } = this.storageService.resolveFilePath(cleanPath);
    if (!exists || !fullPath) {
      throw new NotFoundException('Logo file not found');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    fs.createReadStream(fullPath).pipe(res);
  }
}
