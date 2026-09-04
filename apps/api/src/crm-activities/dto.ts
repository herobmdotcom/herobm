import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsIn,
  IsDateString,
  IsBooleanString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type CrmActivityType,
  type CrmActivityStatus,
  type CrmActivityPriority,
} from '@herobm/shared';
import { PaginationQuery } from '../common/pagination';

export class CreateCrmActivityDto {
  @ApiProperty({ enum: ['call', 'meeting', 'email', 'task', 'note'] })
  @IsIn(['call', 'meeting', 'email', 'task', 'note'])
  type!: CrmActivityType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['open', 'completed', 'cancelled', 'scheduled'] })
  @IsIn(['open', 'completed', 'cancelled', 'scheduled'])
  status!: CrmActivityStatus;

  @ApiProperty({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority!: CrmActivityPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  contactIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}

export class UpdateCrmActivityDto {
  @ApiPropertyOptional({ enum: ['call', 'meeting', 'email', 'task', 'note'] })
  @IsOptional()
  @IsIn(['call', 'meeting', 'email', 'task', 'note'])
  type?: CrmActivityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: ['open', 'completed', 'cancelled', 'scheduled'],
  })
  @IsOptional()
  @IsIn(['open', 'completed', 'cancelled', 'scheduled'])
  status?: CrmActivityStatus;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: CrmActivityPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  contactIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}

export class CrmActivityQueryDto extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  declare opportunityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional({ enum: ['call', 'meeting', 'email', 'task', 'note'] })
  @IsOptional()
  @IsIn(['call', 'meeting', 'email', 'task', 'note'])
  type?: CrmActivityType;

  @ApiPropertyOptional({
    enum: ['open', 'completed', 'cancelled', 'scheduled'],
  })
  @IsOptional()
  @IsIn(['open', 'completed', 'cancelled', 'scheduled'])
  status?: CrmActivityStatus;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: CrmActivityPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  myTasks?: string;
}

export class ActivityContactDto {
  @ApiProperty()
  contactId!: string;

  @ApiProperty()
  fullName!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  jobTitle?: string | null;
}

export class CrmActivityResponseDto {
  @ApiProperty()
  activityId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  subject!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  priority!: string;

  @ApiPropertyOptional()
  actorId?: string | null;

  @ApiPropertyOptional({ type: () => [ActivityContactDto] })
  contacts?: ActivityContactDto[];

  @ApiPropertyOptional()
  opportunityId?: string | null;

  @ApiPropertyOptional()
  dueDate?: Date | null;

  @ApiPropertyOptional()
  assignedToUserId?: string | null;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  @ApiPropertyOptional()
  completedByUserId?: string | null;

  @ApiProperty()
  createdBy!: string;

  @ApiPropertyOptional()
  createdById?: string | null;

  @ApiProperty()
  createdOn!: Date;

  @ApiProperty()
  modifiedOn!: Date;

  @ApiPropertyOptional()
  actorName?: string | null;

  @ApiPropertyOptional()
  opportunityName?: string | null;

  @ApiPropertyOptional()
  assignedToName?: string | null;
}

export class EmptyBodyDto {}
