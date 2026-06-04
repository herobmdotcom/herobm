import { ApiProperty, ApiPropertyOptions } from '@nestjs/swagger';

/**
 * Decorator to explicitly mark a DTO field as a computed metric.
 * This ensures the field passes the DTO-Schema Parity reflection tests,
 * which ordinarily require all primitive DTO fields to physically exist
 * in the underlying Drizzle database schema.
 */
export function ComputedMetric(
  options?: ApiPropertyOptions,
): PropertyDecorator {
  const description = options?.description
    ? `[COMPUTED] ${options.description}`
    : '[COMPUTED]';

  return ApiProperty({
    ...options,
    description,
  });
}
