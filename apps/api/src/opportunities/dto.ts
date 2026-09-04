import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumberString,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOpportunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  estimatedValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  actualValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateOpportunityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  estimatedValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  actualValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateOpportunityNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class OpportunityNoteResponseDto {
  @ApiProperty()
  @IsUUID()
  noteId!: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty()
  @IsString()
  createdOn!: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  createdById?: string;

  @ApiPropertyOptional()
  @IsOptional()
  createdBy?: unknown;
}

export class CreateOpportunityContactDto {
  @ApiProperty()
  @IsUUID()
  contactId!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}

export class UpdateOpportunityContactDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}

export class CreateOpportunityActorDto {
  @ApiProperty()
  @IsUUID()
  actorId!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}

export class UpdateOpportunityActorDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}

export class OpportunityResponseDto {
  @ApiProperty()
  @IsUUID()
  opportunityId!: string;

  @ApiProperty()
  @IsString()
  stateCode!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  status!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  estimatedValue?: string | null;

  @ApiPropertyOptional()
  currencyCode?: string | null;

  @ApiPropertyOptional()
  targetCloseDate?: Date | null;

  @ApiPropertyOptional()
  probability?: number | null;

  @ApiPropertyOptional()
  actualValue?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  createdOn!: Date;

  @ApiProperty()
  modifiedOn!: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  owner?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  notes?: OpportunityNoteResponseDto[];

  @ApiPropertyOptional()
  @IsOptional()
  opportunityActors?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  opportunityContacts?: unknown[];

  @ApiPropertyOptional({
    description:
      'Total deal revenue calculated live from linked sales quote line items',
  })
  @IsOptional()
  dealRevenue?: number | null;

  @ApiPropertyOptional({ description: 'Total number of linked sales quotes' })
  @IsOptional()
  quoteCount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  events?: unknown[];
}

export class EmptyBodyDto {}

export class SuccessResponseDto {
  @ApiProperty()
  success!: boolean;
}

export class OpportunityQueryDto {
  @ApiPropertyOptional({ required: false, type: String })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ required: false, type: String })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ required: false, type: String })
  @IsOptional()
  @IsString()
  status?: string;
}

// Aliases for Projects backward compatibility
export {
  CreateOpportunityDto as CreateProjectDto,
  UpdateOpportunityDto as UpdateProjectDto,
  CreateOpportunityNoteDto as CreateProjectNoteDto,
  OpportunityNoteResponseDto as ProjectNoteResponseDto,
  CreateOpportunityContactDto as CreateProjectContactDto,
  UpdateOpportunityContactDto as UpdateProjectContactDto,
  CreateOpportunityActorDto as CreateProjectActorDto,
  UpdateOpportunityActorDto as UpdateProjectActorDto,
  OpportunityResponseDto as ProjectResponseDto,
  OpportunityQueryDto as ProjectQueryDto,
};
