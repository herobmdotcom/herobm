import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class EnrichmentPayloadDto {
  @ApiPropertyOptional({
    description: 'Dynamic payload for the enrichment provider',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  // Dynamic payload from unknown downstream providers cannot be strictly typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  payload?: Record<string, any>;
}
