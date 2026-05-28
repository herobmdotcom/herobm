import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsUrl,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty()
  @IsUrl()
  @IsNotEmpty()
  targetUrl!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  eventTypes!: string[];
}

export class UpdateWebhookDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  targetUrl?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WebhookResponseDto {
  @ApiProperty({ format: 'uuid' })
  webhookId!: string;

  @ApiProperty()
  targetUrl!: string;

  @ApiProperty({ type: [String] })
  eventTypes!: string[];

  @ApiProperty()
  secretKey!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'date-time', nullable: true })
  createdOn!: Date | null;
}
