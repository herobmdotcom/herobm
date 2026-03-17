import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';

// We mock child_process.execFile and fs at the module level
jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import { execFile } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const mockExecFile = execFile as unknown as jest.Mock;
const mockWriteFileSync = writeFileSync as unknown as jest.Mock;
const mockUnlinkSync = unlinkSync as unknown as jest.Mock;

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportService],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  it('should write JSON data to temp file and invoke typst with template path', async () => {
    const fakePdf = Buffer.from('%PDF-1.4 fake content');

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: any,
        callback: (...args: any[]) => void,
      ) => {
        callback(null, fakePdf, Buffer.alloc(0));
      },
    );

    const data = { header: { orderNumber: 'ORD-001' }, pickingLines: [] };
    const result = await service.compilePdf('/path/to/template.typ', data);

    // Should have written JSON to a temp file
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [jsonPath, jsonContent] = mockWriteFileSync.mock.calls[0];
    expect(jsonPath).toContain('typst-data-');
    expect(JSON.parse(jsonContent)).toEqual(data);

    // Should have invoked typst with template path and --input
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockExecFile.mock.calls[0];
    expect(cmd).toBe('typst');
    expect(args).toContain('compile');
    expect(args).toContain('/path/to/template.typ');
    expect(args).toContain('-');
    expect(args).toContain('--input');
    expect(args.find((a: string) => a.startsWith('data='))).toBeDefined();

    // Should return the PDF buffer
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toContain('%PDF');

    // Should clean up the temp file
    expect(mockUnlinkSync).toHaveBeenCalledWith(jsonPath);
  });

  it('should throw on non-zero exit code and still clean up', async () => {
    // Suppress Logger.error for this specific expected failure
    const loggerSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => {});

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: any,
        callback: (...args: any[]) => void,
      ) => {
        callback(
          new Error('exit code 1'),
          Buffer.alloc(0),
          Buffer.from('error: unexpected token'),
        );
      },
    );

    await expect(
      service.compilePdf('/path/to/template.typ', { test: true }),
    ).rejects.toThrow('Typst compilation failed');

    // Verify the logger caught the error as expected
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Typst compilation failed: exit code 1'),
      expect.any(String), // the nestjs logger context (stderr text)
    );
    loggerSpy.mockRestore();

    // Should still clean up the temp file
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
  });

  it('should clean up temp file even if typst fails unexpectedly', async () => {
    const loggerSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => {});

    mockExecFile.mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });

    await expect(
      service.compilePdf('/path/to/template.typ', { test: true }),
    ).rejects.toThrow();

    loggerSpy.mockRestore();

    // Should still clean up
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
  });
});
