import { SystemResource } from '@herobm/shared';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {
  CasbinAction,
  CasbinResource,
  SkipCasbin,
} from '../../auth/casbin.guard';
import { Public } from '../../auth/public.decorator';
import { RATE_LIMITS } from '../config/throttler.config';
import {
  StorageDeleteResponseDto,
  StorageFileResponseDto,
} from './storage.dto';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@Controller('storage')
@CasbinResource(SystemResource.SETTINGS)
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  @Get('images/*path')
  @SkipCasbin()
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.DEFAULT })
  @ApiParam({
    name: 'path',
    type: String,
    required: true,
    description: 'Image relative storage path',
  })
  @ApiOperation({
    summary: 'Stream Storage Image',
    description: 'Publicly stream an image from storage with caching headers.',
  })
  @ApiOkResponse({
    description: 'Image binary content',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  streamImage(
    @Req() req: Request,
    @Res() res: Response,
    @Param('path') _pathParam?: string,
  ) {
    const match = req.url.split('?')[0].match(/\/images\/(.+)$/);
    const imagePath = match ? decodeURIComponent(match[1]) : '';
    if (!imagePath) {
      throw new NotFoundException('Image not found');
    }

    const { fullPath, exists } = this.storageService.resolveFilePath(imagePath);
    if (!exists || !fullPath) {
      this.logger.warn(
        `Image not found for relative path: "${imagePath}" (storageRoot: "${this.storageService.getStorageRoot()}", attempted fullPath: "${fullPath}")`,
      );
      throw new NotFoundException('Image not found');
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

  @Post('images')
  @ApiOkResponse({ type: StorageFileResponseDto })
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Storage category (default: reports)',
  })
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
    summary: 'Upload Storage Image',
    description:
      'Upload an image into a storage category (default: reports, max 5MB).',
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('category') category = 'reports',
  ) {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ];
    if (!allowed.includes(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        'Invalid image format. Allowed: JPG, PNG, WebP, GIF, SVG',
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image exceeds 5MB maximum size limit');
    }

    return this.storageService.saveImage(category, file);
  }

  @Get('images')
  @ApiOkResponse({ type: [StorageFileResponseDto] })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Storage category (default: reports)',
  })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Storage Images',
    description:
      'List images within a storage category (e.g. reports, organization).',
  })
  async listImages(@Query('category') category = 'reports') {
    return this.storageService.listImages(category);
  }

  @Delete('images/*path')
  @ApiOkResponse({ type: StorageDeleteResponseDto })
  @ApiParam({
    name: 'path',
    type: String,
    required: true,
    description: 'Image relative storage path',
  })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Storage Image',
    description: 'Delete an image from storage.',
  })
  async deleteImage(@Req() req: Request, @Param('path') _pathParam?: string) {
    const match = req.url.split('?')[0].match(/\/images\/(.+)$/);
    const imagePath = match ? decodeURIComponent(match[1]) : '';
    if (!imagePath) {
      throw new NotFoundException('Image path not specified');
    }
    const deleted = await this.storageService.deleteFile(imagePath);
    if (!deleted) {
      throw new NotFoundException('Image not found or cannot be deleted');
    }
    return { success: true };
  }
}
