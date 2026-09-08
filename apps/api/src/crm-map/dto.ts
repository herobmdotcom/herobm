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

export class CrmMapNodesDto {
  @ApiProperty({ type: [CrmMapOrganizationNodeDto] })
  organizations!: CrmMapOrganizationNodeDto[];

  @ApiProperty({ type: [CrmMapContactNodeDto] })
  contacts!: CrmMapContactNodeDto[];

  @ApiProperty({ type: [CrmMapOpportunityNodeDto] })
  opportunities!: CrmMapOpportunityNodeDto[];
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
}

export class CrmMapResponseDto {
  @ApiProperty({ type: CrmMapNodesDto })
  nodes!: CrmMapNodesDto;

  @ApiProperty({ type: CrmMapEdgesDto })
  edges!: CrmMapEdgesDto;
}
