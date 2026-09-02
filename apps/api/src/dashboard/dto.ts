import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty()
  customers!: number;

  @ApiProperty()
  products!: number;

  @ApiProperty()
  orderLines!: number;
}

export class SearchResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    enum: [
      'product',
      'customer',
      'sales_order',
      'supplier',
      'purchase_order',
      'shipment',
      'goods_receipt',
      'sales_invoice',
      'purchase_invoice',
      'sales_return',
      'purchase_return',
      'sales_credit_note',
      'purchase_debit_note',
      'transfer_order',
      'work_order',
      'contact',
      'project',
      'payment',
    ],
  })
  type!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  subtitle!: string;

  @ApiProperty()
  href!: string;
}

export class UniversalSearchResponseDto {
  @ApiProperty({ type: [SearchResultDto] })
  results!: SearchResultDto[];
}

export class TimelineEventDto {
  @ApiProperty()
  eventId!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  entityId!: string;

  @ApiProperty()
  entityDisplay!: string;

  @ApiProperty({ nullable: true })
  actor!: string | null;

  @ApiProperty({ required: false, nullable: true })
  payload?: Record<string, unknown> | null;

  @ApiProperty()
  timestamp!: Date;
}
