import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class EmptyStringToUndefinedPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') return value;
    if (typeof value !== 'object' || value === null) return value;

    return this.clean(value);
  }

  private clean(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.clean(v));
    } else if (typeof obj === 'object' && obj !== null) {
      const record = obj as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (record[key] === '') {
          record[key] = undefined;
        } else {
          record[key] = this.clean(record[key]);
        }
      }
      return record;
    }
    return obj;
  }
}
