import { FileLoggerService } from './file-logger.service';
import * as fs from 'fs';
import * as path from 'path';

describe('FileLoggerService', () => {
  const testDir = path.join(process.cwd(), 'logs', '__test_file_logger__');
  const testFilename = 'test-api.log';
  const testFilePath = path.join(testDir, testFilename);
  let originalPipelineLogDir: string | undefined;

  beforeAll(() => {
    originalPipelineLogDir = process.env.PIPELINE_LOG_DIR;
    process.env.PIPELINE_LOG_DIR = testDir;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (originalPipelineLogDir !== undefined) {
      process.env.PIPELINE_LOG_DIR = originalPipelineLogDir;
    } else {
      delete process.env.PIPELINE_LOG_DIR;
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should write formatted log lines to the log file on disk', async () => {
    const logger = new FileLoggerService('TestContext', testFilename);

    logger.log('Informational message from test');
    logger.warn('Warning message from test');
    logger.error('Error message from test', 'CustomStackHere');
    logger.debug('Debug message from test');
    logger.verbose('Verbose message from test');

    // Allow the asynchronous write stream to flush
    await new Promise<void>((resolve) => {
      logger.close();
      setTimeout(resolve, 100);
    });

    expect(fs.existsSync(testFilePath)).toBe(true);
    const content = fs.readFileSync(testFilePath, 'utf8');

    expect(content).toContain(
      '[LOG] [TestContext] Informational message from test',
    );
    expect(content).toContain('[WARN] [TestContext] Warning message from test');
    expect(content).toContain(
      '[ERROR] [TestContext] Error message from test CustomStackHere',
    );
    expect(content).toContain('[DEBUG] [TestContext] Debug message from test');
    expect(content).toContain(
      '[VERBOSE] [TestContext] Verbose message from test',
    );
  });

  it('should securely serialize object payloads to JSON in log lines', async () => {
    const filename = 'test-objects.log';
    const filePath = path.join(testDir, filename);
    const logger = new FileLoggerService('ObjectContext', filename);

    logger.log({ event: 'order_created', orderId: 'ORD-999', total: 42.5 });

    await new Promise<void>((resolve) => {
      logger.close();
      setTimeout(resolve, 100);
    });

    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain(
      '[LOG] [ObjectContext] {"event":"order_created","orderId":"ORD-999","total":42.5}',
    );
  });

  it('should serialize Error instances and stack traces', async () => {
    const filename = 'test-errors.log';
    const filePath = path.join(testDir, filename);
    const logger = new FileLoggerService('ErrorContext', filename);

    const testError = new Error('Database query timed out');
    logger.error(testError);

    await new Promise<void>((resolve) => {
      logger.close();
      setTimeout(resolve, 100);
    });

    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('[ERROR] [ErrorContext]');
    expect(content).toContain('Database query timed out');
  });
});
