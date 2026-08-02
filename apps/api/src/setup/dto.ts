import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WebhookPayloadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  jobId!: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  @MaxLength(10240)
  logLine?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  status!: string;
}
