import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class EmptyStringToUndefinedPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') return value;
    if (typeof value !== 'object' || value === null) return value;

    return this.clean(value);
  }

  private clean(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.clean(v));
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        if (obj[key] === '') {
          obj[key] = undefined;
        } else {
          obj[key] = this.clean(obj[key]);
        }
      }
    }
    return obj;
  }
}
