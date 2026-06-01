import { ConsoleLogger, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileLoggerService extends ConsoleLogger {
  private readonly logFilePath: string;

  constructor(context?: string, filename = 'api.log') {
    super(context || 'App');
    const logDir =
      process.env.PIPELINE_LOG_DIR || path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
      } catch {
        // Ignored
      }
    }
    this.logFilePath = path.join(logDir, filename);
  }

  private appendLog(level: string, message: any, context?: string) {
    const timestamp = new Date().toISOString();
    const ctx = context || this.context;

    // Attempt to stringify objects securely
    let msgStr = '';
    if (typeof message === 'object') {
      try {
        msgStr = JSON.stringify(message);
      } catch {
        msgStr = String(message);
      }
    } else {
      msgStr = String(message);
    }

    const logLine = `[${timestamp}] [${level.toUpperCase()}] [${ctx}] ${msgStr}\n`;
    try {
      fs.appendFileSync(this.logFilePath, logLine);

      // Rotate if larger than 20MB
      const stats = fs.statSync(this.logFilePath);
      if (stats.size > 20 * 1024 * 1024) {
        const backupPath = `${this.logFilePath}.1`;
        try {
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
          fs.renameSync(this.logFilePath, backupPath);
        } catch {
          fs.writeFileSync(this.logFilePath, '');
        }
      }
    } catch {
      // Silently fail if file system is inaccessible
    }
  }

  log(message: any, context?: string) {
    super.log(message, context);
    this.appendLog('log', message, context);
  }

  error(message: any, stack?: string, context?: string) {
    super.error(message, stack, context);
    this.appendLog('error', `${message} ${stack || ''}`, context);
  }

  warn(message: any, context?: string) {
    super.warn(message, context);
    this.appendLog('warn', message, context);
  }

  debug(message: any, context?: string) {
    super.debug(message, context);
    this.appendLog('debug', message, context);
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context);
    this.appendLog('verbose', message, context);
  }
}
