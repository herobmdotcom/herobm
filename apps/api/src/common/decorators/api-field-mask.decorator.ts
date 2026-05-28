import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { FieldMaskInterceptor } from '../interceptors/field-mask.interceptor';

/**
 * Applies a `?fields=` query parameter to the OpenAPI spec and registers the
 * FieldMaskInterceptor to automatically filter the response payload to only
 * those fields. Useful for reducing payload size for AI agents.
 */
export function ApiFieldMask() {
  return applyDecorators(
    ApiQuery({
      name: 'fields',
      required: false,
      type: String,
      description:
        'Comma separated list of fields to include in the response (e.g. "id,name")',
    }),
    UseInterceptors(FieldMaskInterceptor),
  );
}
