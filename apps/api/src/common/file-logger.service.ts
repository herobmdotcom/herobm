import { ConsoleLogger, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

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

  private appendLog(level: string, message: unknown, context?: string) {
    const timestamp = new Date().toISOString();
    const ctx = context || this.context;

    // Attempt to stringify objects securely
    let msgStr = '';
    if (typeof message === 'string') {
      msgStr = message;
    } else if (message instanceof Error) {
      msgStr = message.stack || message.message;
    } else {
      try {
        msgStr = JSON.stringify(message);
      } catch {
        msgStr = util.inspect(message);
      }
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

  log(message: unknown, context?: string) {
    super.log(message, context);
    this.appendLog('log', message, context);
  }

  error(message: unknown, stack?: string, context?: string) {
    super.error(message, stack, context);
    const errStr =
      typeof message === 'string' ? message : util.inspect(message);
    this.appendLog('error', `${errStr} ${stack || ''}`, context);
  }

  warn(message: unknown, context?: string) {
    super.warn(message, context);
    this.appendLog('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    super.debug(message, context);
    this.appendLog('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    super.verbose(message, context);
    this.appendLog('verbose', message, context);
  }
}
