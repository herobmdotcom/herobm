import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ConvertEmptyStringsToNullMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      req.body = this.cleanObject(req.body);
    }
    next();
  }

  private cleanObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanObject(item));
    }

    if (typeof obj === 'object') {
      const cleanedObj: Record<string, unknown> = {};
      const objRecord = obj as Record<string, unknown>;
      for (const key in objRecord) {
        if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
          if (objRecord[key] === '') {
            cleanedObj[key] = null;
          } else {
            cleanedObj[key] = this.cleanObject(objRecord[key]);
          }
        }
      }
      return cleanedObj;
    }

    if (obj === '') {
      return null;
    }

    return obj;
  }
}
