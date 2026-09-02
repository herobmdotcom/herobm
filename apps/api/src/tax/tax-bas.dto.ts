import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class BasSummaryQueryDto {
  @ApiProperty({
    description: 'Start date of the reporting period (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'End date of the reporting period (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class BasSummaryRowDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  amount!: number;
}
