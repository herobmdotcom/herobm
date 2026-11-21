import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class BulkUpdateResponseDto {
  @ApiProperty({
    description: 'Number of records successfully updated',
    example: 42,
  })
  @IsNumber()
  updatedCount!: number;

  @ApiProperty({
    description: 'Number of records skipped because no fields were changed',
    example: 3,
  })
  @IsNumber()
  skippedCount!: number;
}
