import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SuccessResponseDto {
  @ApiProperty({
    description: 'Indicates whether the operation was successful',
    example: true,
  })
  @IsBoolean()
  success!: boolean;
}
