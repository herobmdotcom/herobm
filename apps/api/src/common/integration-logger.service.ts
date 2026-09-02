import { Injectable, Scope } from '@nestjs/common';
import { FileLoggerService } from './file-logger.service';

@Injectable({ scope: Scope.TRANSIENT })
export class IntegrationLoggerService extends FileLoggerService {
  constructor() {
    super('IntegrationEngine', 'integration.log');
  }
}
