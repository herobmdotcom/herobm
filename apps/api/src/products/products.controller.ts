import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Patch,
  Body,
  Delete,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../common/config/throttler.config';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ProductsService } from './products.service';
import { ProductsWriteService } from './products-write.service';
import { StorageService } from '../common/storage/storage.service';
import {
  AddSupplierDto,
  CreateProductDto,
  UpdateProductDto,
  LinkBinDto,
  ProductResponseDto,
  AddProductUomDto,
  AddProductComponentDto,
  UpdateProductComponentDto,
  EmptyBodyDto,
} from './dto';
import { CasbinResource, CasbinAction, SkipCasbin } from '../auth/casbin.guard';
import { Public } from '../auth/public.decorator';
import { PaginationQuery, ApiPaginatedResponse } from '../common/pagination';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Products')
@Controller('products')
@CasbinResource(SystemResource.PRODUCTS)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsWriteService: ProductsWriteService,
    private readonly storageService: StorageService,
  ) {}

  @Get('images/*path')
  @SkipCasbin()
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.DEFAULT })
  @ApiParam({
    name: 'path',
    type: String,
    required: true,
    description: 'Product image relative path',
  })
  @ApiOperation({
    summary: 'Stream Product Image',
    description: 'Publicly stream a product image with caching headers.',
  })
  @ApiOkResponse({
    description: 'Product image binary content',
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

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Products',
    description: 'Retrieve a paginated list of all products in the catalog.',
  })
  @ApiFieldMask()
  @ApiPaginatedResponse(ProductResponseDto)
  findAll(@Query() query: PaginationQuery) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Product',
    description:
      'Retrieve detailed information for a specific product by its unique identifier.',
  })
  @ApiFieldMask()
  @ApiOkResponse({ type: ProductResponseDto })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateProductDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Product',
    description:
      'Register a new product in the catalog with its initial details.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  create(@Body() dto: CreateProductDto, @AuthUser() user: JwtUser) {
    return this.productsWriteService.create(dto, user.username);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateProductDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Product',
    description: 'Modify the details of an existing product.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.update(id, dto, user.username);
  }

  @Post(':id/archive')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Product',
    description:
      'Mark a product as archived to prevent it from being used in new transactions.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  archive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.productsWriteService.archive(id, user.username);
  }

  @Post(':id/unarchive')
  @ApiBody({ type: EmptyBodyDto })
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Product',
    description: 'Restore an archived product to active status.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  unarchive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.productsWriteService.unarchive(id, user.username);
  }

  @Post(':id/suppliers')
  @ApiBody({ type: AddSupplierDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Product Supplier',
    description: 'Link a supplier to a product for purchasing purposes.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  addSupplier(
    @Param('id') productId: string,
    @Body() dto: AddSupplierDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.addSupplier(productId, dto, user.username);
  }

  @Delete(':id/suppliers/:vendorId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Product Supplier',
    description: 'Unlink a supplier from a product.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  removeSupplier(
    @Param('id') productId: string,
    @Param('vendorId') vendorId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.removeSupplier(
      productId,
      vendorId,
      user.username,
    );
  }

  @Post(':id/uoms')
  @ApiBody({ type: AddProductUomDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Product UOM',
    description: 'Define a new Unit of Measure for the product.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  addUom(
    @Param('id') productId: string,
    @Body() dto: AddProductUomDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.addUom(productId, dto, user.username);
  }

  @Delete(':id/uoms/:uomId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Product UOM',
    description: 'Delete a previously assigned Unit of Measure from a product.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  removeUom(
    @Param('id') productId: string,
    @Param('uomId') uomId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.removeUom(productId, uomId, user.username);
  }

  @Post(':id/default-bins')
  @ApiBody({ type: LinkBinDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Link Default Bin',
    description:
      'Assign a default storage bin to a product for inventory management.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  linkDefaultBin(
    @Param('id') productId: string,
    @Body() dto: LinkBinDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.linkDefaultBin(
      productId,
      dto,
      user.username,
    );
  }

  @Delete(':id/default-bins/:binLinkId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Default Bin',
    description: 'Remove the default storage bin assignment from a product.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  removeDefaultBin(
    @Param('id') id: string,
    @Param('binLinkId') binLinkId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.removeDefaultBin(binLinkId, user.username);
  }

  @Get(':id/components')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Components',
    description:
      'Retrieve the list of sub-components or ingredients that make up a product.',
  })
  @ApiPaginatedResponse(ProductResponseDto)
  getComponents(@Param('id') productId: string) {
    return this.productsService.getComponents(productId);
  }

  @Post(':id/components')
  @ApiBody({ type: AddProductComponentDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Component',
    description: 'Add a new sub-component to the product bill of materials.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  addComponent(
    @Param('id') productId: string,
    @Body()
    dto: AddProductComponentDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.addComponent(
      productId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      dto as any,
      user.username,
    );
  }

  @Patch(':id/components/:componentId')
  @ApiBody({ type: UpdateProductComponentDto })
  @CasbinAction('write')
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiOperation({
    summary: 'Update Component',
    description:
      'Modify the details (like quantity) of an existing product component.',
  })
  updateComponent(
    @Param('id') productId: string,
    @Param('componentId') componentId: string,
    @Body() dto: UpdateProductComponentDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.updateComponent(
      productId,
      componentId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      dto as any,
      user.username,
    );
  }

  @Delete(':id/components/:componentId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Component',
    description: 'Remove a sub-component from the product bill of materials.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  removeComponent(
    @Param('id') productId: string,
    @Param('componentId') componentId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.productsWriteService.removeComponent(
      productId,
      componentId,
      user.username,
    );
  }

  @Post(':id/image')
  @ApiOkResponse({ type: ProductResponseDto })
  @HttpCode(HttpStatus.OK)
  @CasbinAction('write')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPG, PNG, WebP, GIF, SVG up to 5MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Upload Product Image',
    description: 'Upload and set the primary image for a product (max 5MB).',
  })
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @AuthUser() user: JwtUser,
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
    await this.productsWriteService.uploadImage(id, file, user.username);
    return this.productsService.findOne(id);
  }

  @Delete(':id/image')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Product Image',
    description: 'Remove the assigned image from a product.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  async removeImage(@Param('id') id: string, @AuthUser() user: JwtUser) {
    await this.productsWriteService.removeImage(id, user.username);
    return this.productsService.findOne(id);
  }
}
