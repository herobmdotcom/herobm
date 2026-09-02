import { ConsoleLogger, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

@Injectable()
export class FileLoggerService extends ConsoleLogger {
  private readonly logFilePath: string;
  private writeStream: fs.WriteStream | null = null;
  private bytesWrittenSinceCheck = 0;
  private isRotating = false;
  private static readonly ROTATION_THRESHOLD = 20 * 1024 * 1024; // 20 MB
  private static readonly CHECK_INTERVAL_BYTES = 100 * 1024; // Check every 100KB

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
    this.initWriteStream();
  }

  private initWriteStream(): void {
    try {
      if (this.writeStream) {
        this.writeStream.removeAllListeners();
        this.writeStream.end();
      }
      this.writeStream = fs.createWriteStream(this.logFilePath, {
        flags: 'a',
        encoding: 'utf8',
      });
      this.writeStream.on('error', () => {
        // Silently handle stream errors without crashing
      });
    } catch {
      this.writeStream = null;
    }
  }

  private checkAndRotate(): void {
    if (this.isRotating) return;
    fs.stat(this.logFilePath, (err, stats) => {
      if (!err && stats.size > FileLoggerService.ROTATION_THRESHOLD) {
        this.isRotating = true;
        const backupPath = `${this.logFilePath}.1`;
        try {
          if (this.writeStream) {
            this.writeStream.end(() => {
              try {
                if (fs.existsSync(backupPath)) {
                  fs.unlinkSync(backupPath);
                }
                fs.renameSync(this.logFilePath, backupPath);
              } catch {
                try {
                  fs.writeFileSync(this.logFilePath, '');
                } catch {
                  // Ignored
                }
              } finally {
                this.isRotating = false;
                this.initWriteStream();
              }
            });
            return;
          }
        } catch {
          this.isRotating = false;
        }
      }
    });
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

    if (!this.writeStream) {
      this.initWriteStream();
    }

    if (this.writeStream && !this.isRotating) {
      try {
        this.writeStream.write(logLine);
        this.bytesWrittenSinceCheck += Buffer.byteLength(logLine, 'utf8');
        if (
          this.bytesWrittenSinceCheck > FileLoggerService.CHECK_INTERVAL_BYTES
        ) {
          this.bytesWrittenSinceCheck = 0;
          this.checkAndRotate();
        }
      } catch {
        // Silently fail if stream is temporarily unavailable
      }
    }
  }

  close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
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
