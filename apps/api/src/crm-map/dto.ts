import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CrmMapQueryDto {
  @ApiPropertyOptional({ description: 'ID of the focal node' })
  @IsOptional()
  @IsString()
  focalNodeId?: string;

  @ApiPropertyOptional({
    description: 'Max distance from the focal node',
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDistance?: number;
}

export class CrmMapOrganizationNodeDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  industry?: string;
}

export class CrmMapContactNodeDto {
  @ApiProperty()
  contactId!: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;
}

export class CrmMapOpportunityNodeDto {
  @ApiProperty()
  opportunityId!: string;

  @ApiPropertyOptional()
  name?: string;
}

export class CrmMapSalesOrderNodeDto {
  @ApiProperty()
  salesOrderId!: string;

  @ApiProperty()
  orderNumber!: string;

  @ApiProperty()
  stateCode!: string;

  @ApiPropertyOptional()
  baseTotalAmount?: string | null;

  @ApiProperty()
  currencyCode!: string;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  createdOn?: Date | string | null;
}

export class CrmMapProjectNodeDto {
  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  projectNumber!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  stateCode!: string;

  @ApiPropertyOptional()
  stage?: string | null;

  @ApiProperty()
  billingType!: string;
}

export class CrmMapOrganizationOrganizationLinkDto {
  @ApiProperty()
  sourceOrganizationId!: string;

  @ApiProperty()
  targetOrganizationId!: string;
}

export class CrmMapOrganizationContactLinkDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  contactId!: string;

  @ApiPropertyOptional({ type: [String] })
  primaryFor?: string[];
}

export class CrmMapOpportunityOrganizationLinkDto {
  @ApiProperty()
  opportunityId!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiPropertyOptional({ type: [String] })
  roles?: string[];
}

export class CrmMapOpportunityContactLinkDto {
  @ApiProperty()
  opportunityId!: string;

  @ApiProperty()
  contactId!: string;

  @ApiPropertyOptional({ type: [String] })
  roles?: string[];
}

export class CrmMapOrganizationSalesOrderLinkDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  salesOrderId!: string;
}

export class CrmMapOpportunitySalesOrderLinkDto {
  @ApiProperty()
  opportunityId!: string;

  @ApiProperty()
  salesOrderId!: string;
}

export class CrmMapOrganizationProjectLinkDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;
}

export class CrmMapOpportunityProjectLinkDto {
  @ApiProperty()
  opportunityId!: string;

  @ApiProperty()
  projectId!: string;
}

export class CrmMapNodesDto {
  @ApiProperty({ type: [CrmMapOrganizationNodeDto] })
  organizations!: CrmMapOrganizationNodeDto[];

  @ApiProperty({ type: [CrmMapContactNodeDto] })
  contacts!: CrmMapContactNodeDto[];

  @ApiProperty({ type: [CrmMapOpportunityNodeDto] })
  opportunities!: CrmMapOpportunityNodeDto[];

  @ApiProperty({ type: [CrmMapSalesOrderNodeDto] })
  salesOrders!: CrmMapSalesOrderNodeDto[];

  @ApiProperty({ type: [CrmMapProjectNodeDto] })
  projects!: CrmMapProjectNodeDto[];
}

export class CrmMapEdgesDto {
  @ApiPropertyOptional({ type: [CrmMapOrganizationOrganizationLinkDto] })
  organizationOrganization?: CrmMapOrganizationOrganizationLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapOrganizationContactLinkDto] })
  organizationContact?: CrmMapOrganizationContactLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapOpportunityOrganizationLinkDto] })
  opportunityOrganization?: CrmMapOpportunityOrganizationLinkDto[];

  @ApiProperty({ type: [CrmMapOpportunityContactLinkDto] })
  opportunityContact!: CrmMapOpportunityContactLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapOrganizationOrganizationLinkDto] })
  referralOrganizationOrganization?: CrmMapOrganizationOrganizationLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapOrganizationContactLinkDto] })
  referralContactOrganization?: CrmMapOrganizationContactLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapOrganizationSalesOrderLinkDto] })
  organizationSalesOrder?: CrmMapOrganizationSalesOrderLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapOpportunitySalesOrderLinkDto] })
  opportunitySalesOrder?: CrmMapOpportunitySalesOrderLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapOrganizationProjectLinkDto] })
  organizationProject?: CrmMapOrganizationProjectLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapOpportunityProjectLinkDto] })
  opportunityProject?: CrmMapOpportunityProjectLinkDto[];
}

export class CrmMapResponseDto {
  @ApiProperty({ type: CrmMapNodesDto })
  nodes!: CrmMapNodesDto;

  @ApiProperty({ type: CrmMapEdgesDto })
  edges!: CrmMapEdgesDto;
}
