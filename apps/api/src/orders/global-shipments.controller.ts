import { DATA_SOURCE_CONTEXT, SystemResource } from '@herobm/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';
import { EmailDocumentDto, ShipmentResponseDto } from './dto';
import { ShipmentsCoreService } from './shipments/shipments-core.service';
import { ShipmentsWriteService } from './shipments/shipments-write.service';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

import type { JwtUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth-user.decorator';

@ApiTags('Warehouse')
@Controller('shipments')
@CasbinResource(SystemResource.SALES_ORDERS)
export class GlobalShipmentsController {
  constructor(
    private readonly shipmentsCoreService: ShipmentsCoreService,
    private readonly shipmentsWriteService: ShipmentsWriteService,
    private readonly documentDispatchService: DocumentDispatchService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ShipmentResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find All Shipments',
    description: 'Retrieve a list of shipments globally.',
  })
  @ApiFieldMask()
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'salesOrderId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('days') days?: string,
    @Query('salesOrderId') salesOrderId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.shipmentsCoreService.findAll({
      days: days ? parseInt(days, 10) : undefined,
      salesOrderId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return data;
  }

  @Get(':id')
  @ApiOkResponse({ type: ShipmentResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Shipment',
    description: 'Retrieve detailed information for a specific shipment.',
  })
  @ApiFieldMask()
  async findOne(@Param('id') id: string) {
    return this.shipmentsCoreService.findOne(id);
  }

  @Post(':id/email-document')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Email Shipment Document',
    description:
      'Generates and sends a shipment document (e.g. shipping docket) as an email attachment.',
  })
  @ApiCreatedResponse({
    description: 'Email queued successfully.',
    schema: { type: 'object', properties: { success: { type: 'boolean' } } },
  })
  @ApiBody({ type: EmailDocumentDto })
  async emailDocument(
    @Param('id') id: string,
    @Body() dto: EmailDocumentDto,
    @AuthUser() user: JwtUser,
  ) {
    const shipment = await this.shipmentsCoreService.findOne(id);
    const hookSlug = dto.hookSlug || 'shipping-docket';

    return this.documentDispatchService.emailDocument(
      {
        targetId: dto.targetId || id,
        hookSlug,
        contextSlug: dto.contextSlug || DATA_SOURCE_CONTEXT.SHIPMENT,
        entityType: 'shipment',
        entityId: id,
        emailAddress: dto.emailAddress,
        subject: dto.subject,
        body: dto.body,
        customPdfText: dto.customPdfText,
        fallbackFileName: `ShippingDocket-${shipment.shipmentNumber}.pdf`,
      },
      user,
    );
  }
}
