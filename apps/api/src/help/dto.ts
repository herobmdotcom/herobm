import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class HelpContextQueryDto {
  @ApiProperty({ description: 'The screen route path to resolve help for' })
  @IsString()
  @IsNotEmpty()
  route!: string;
}

export class HelpSearchQueryDto {
  @ApiProperty({ description: 'The search query' })
  @IsString()
  @IsNotEmpty()
  q!: string;
}

export class HelpTopicSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  category!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  order!: number;

  @ApiProperty({ type: [String] })
  routes!: string[];

  @ApiProperty({ type: [String] })
  tags!: string[];
}

export class HelpTopicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  order?: number;

  @ApiPropertyOptional({ type: [String] })
  routes?: string[];

  @ApiPropertyOptional()
  resource?: string;

  @ApiPropertyOptional()
  action?: string;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  fields?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  related?: string[];

  @ApiProperty()
  content!: string;

  @ApiProperty()
  filePath!: string;
}

export class RelatedTopicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  category?: string;
}

export class HelpContextResponseDto {
  @ApiPropertyOptional({ type: () => HelpTopicDto, nullable: true })
  topic!: HelpTopicDto | null;

  @ApiPropertyOptional()
  matchedRoute?: string;

  @ApiProperty({ type: [RelatedTopicDto] })
  relatedTopics!: RelatedTopicDto[];
}

export class HelpSearchResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  snippet!: string;

  @ApiProperty()
  score!: number;
}
