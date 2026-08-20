import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject, IsString } from 'class-validator';

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

export class UpdateEnrichmentConfigDto {
  @ApiPropertyOptional({
    description: 'Provider configuration JSON key-value pairs',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Saved test payload string or JSON',
  })
  @IsOptional()
  @IsString()
  testPayload?: string;
}

export class EnrichmentResultDto {
  @ApiProperty()
  isValid!: boolean;

  @ApiProperty({ type: Object })
  data!: Record<string, unknown>;
}

export class EnrichmentProviderDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: [String] })
  supportedCountries!: string[] | string;

  @ApiProperty({ type: Object })
  schema!: Record<string, unknown>;
}

export class EnrichmentConfigResponseDto {
  @ApiProperty({ type: Object })
  config!: Record<string, unknown>;
}
