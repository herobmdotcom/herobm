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

export class CrmMapActorNodeDto {
  @ApiProperty()
  actorId!: string;

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

export class CrmMapProjectNodeDto {
  @ApiProperty()
  projectId!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  name?: string;
}

export class CrmMapActorActorLinkDto {
  @ApiProperty()
  sourceActorId!: string;

  @ApiProperty()
  targetActorId!: string;
}

export class CrmMapActorContactLinkDto {
  @ApiProperty()
  actorId!: string;

  @ApiProperty()
  contactId!: string;

  @ApiPropertyOptional({ type: [String] })
  primaryFor?: string[];
}

export class CrmMapProjectActorLinkDto {
  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  actorId!: string;

  @ApiPropertyOptional({ type: [String] })
  roles?: string[];
}

export class CrmMapProjectContactLinkDto {
  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  contactId!: string;

  @ApiPropertyOptional({ type: [String] })
  roles?: string[];
}

export class CrmMapNodesDto {
  @ApiProperty({ type: [CrmMapActorNodeDto] })
  actors!: CrmMapActorNodeDto[];

  @ApiProperty({ type: [CrmMapContactNodeDto] })
  contacts!: CrmMapContactNodeDto[];

  @ApiProperty({ type: [CrmMapProjectNodeDto] })
  projects!: CrmMapProjectNodeDto[];
}

export class CrmMapEdgesDto {
  @ApiProperty({ type: [CrmMapActorActorLinkDto] })
  actorActor!: CrmMapActorActorLinkDto[];

  @ApiProperty({ type: [CrmMapActorContactLinkDto] })
  actorContact!: CrmMapActorContactLinkDto[];

  @ApiProperty({ type: [CrmMapProjectActorLinkDto] })
  projectActor!: CrmMapProjectActorLinkDto[];

  @ApiProperty({ type: [CrmMapProjectContactLinkDto] })
  projectContact!: CrmMapProjectContactLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapActorActorLinkDto] })
  referralActorActor?: CrmMapActorActorLinkDto[];

  @ApiPropertyOptional({ type: [CrmMapActorContactLinkDto] })
  referralContactActor?: CrmMapActorContactLinkDto[];
}

export class CrmMapResponseDto {
  @ApiProperty({ type: CrmMapNodesDto })
  nodes!: CrmMapNodesDto;

  @ApiProperty({ type: CrmMapEdgesDto })
  edges!: CrmMapEdgesDto;
}
