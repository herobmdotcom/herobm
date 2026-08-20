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
    enum: ['product', 'customer', 'sales_order', 'supplier', 'purchase_order'],
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

  @ApiProperty()
  timestamp!: Date;
}
