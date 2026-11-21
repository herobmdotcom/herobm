import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class WebhookPayloadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  jobId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  stage?: string;

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

export { SuccessResponseDto } from '../common/dto/success-response.dto';
