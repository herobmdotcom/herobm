import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class EnrichmentPayloadDto {
  @ApiPropertyOptional({
    description: 'Dynamic payload for the enrichment provider',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}
