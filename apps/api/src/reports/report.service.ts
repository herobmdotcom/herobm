import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join, dirname, basename } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

/**
 * Low-level Typst CLI wrapper.
 *
 * Compiles Typst templates to PDF by invoking `typst compile`.
 * Requires the `typst` CLI to be available on $PATH.
 *
 * Install (Windows): `winget install --id Typst.Typst`
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  /**
   * Compile a Typst template file to a PDF buffer, passing structured
   * data via a temporary JSON file that the template reads with `json()`.
   *
   * @param templatePath  Absolute path to the .typ template
   * @param data          Data object — written as JSON for the template to consume
   * @returns             PDF file contents as a Buffer
   */
  async compilePdf(templatePath: string, data: unknown): Promise<Buffer> {
    // Typst's json() function resolves paths relative to the template file.
    // If we pass an absolute path like /tmp/file.json, it interprets it as
    // /project_root/tmp/file.json. So we write the temp file next to the template.
    const templateRoot = dirname(templatePath);
    const jsonFilename = `typst-data-${randomUUID()}.json`;
    const jsonPath = join(templateRoot, jsonFilename);

    try {
      writeFileSync(jsonPath, JSON.stringify(data), 'utf-8');

      const pdf = await this.invokeTypst(templatePath, jsonFilename);
      return pdf;
    } finally {
      // Clean up the temp JSON file
      try {
        unlinkSync(jsonPath);
      } catch {
        // Best-effort cleanup
      }
    }
  }

  /**
   * Invoke the Typst CLI to compile a template with a JSON data input.
   *
   * Command: `typst compile template.typ - --input data=path/to/data.json`
   * The `-` as output path means stdout → we capture the PDF buffer.
   */
  private invokeTypst(templatePath: string, jsonPath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      execFile(
        process.env.TYPST_BINARY_PATH || 'typst',
        [
          'compile',
          templatePath,
          '-', // output to stdout
          '--input',
          `data=${jsonPath}`, // pass JSON path as sys.inputs.data
        ],
        { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            const stderrText = stderr ? stderr.toString('utf-8') : '';
            this.logger.error(
              `Typst compilation failed: ${error.message}`,
              stderrText,
            );
            reject(
              new Error(
                `Typst compilation failed: ${stderrText || error.message}`,
              ),
            );
            return;
          }
          resolve(stdout as unknown as Buffer);
        },
      );
    });
  }
}
