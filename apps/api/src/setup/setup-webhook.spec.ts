import { pipelineJobs } from '@herobm/db-schema';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { SetupService } from './setup.service';

describe('SetupService - Webhook & Job Completion Resilience (Unit)', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: SetupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn(),
            reload: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SetupService>(SetupService);
    await pg.db.delete(pipelineJobs);
  });

  it('should mark pipelineJob as done when receiving done webhook even without in-memory resolver', async () => {
    const jobId = 'test-job-no-resolver-1';
    await pg.db.insert(pipelineJobs).values({
      jobId,
      type: 'abm',
      status: 'running',
      progressJson: [
        { step: 1, name: 'Importing Data (ELT)', status: 'running' },
      ],
      logsJson: [],
    });

    await service.handleWebhook({
      jobId,
      stage: 'transform',
      logLine: 'Process exited with code 0',
      status: 'done',
    });

    const [job] = await pg.db
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.jobId, jobId))
      .limit(1);

    expect(job).toBeDefined();
    expect(job.status).toBe('done');
    expect(job.logsJson).toContain('Process exited with code 0');
    expect(job.logsJson).toContain('DATA IMPORT COMPLETED SUCCESSFULLY');
  });

  it('should self-heal job status in getJobProgress if logs contain successful process exit', async () => {
    const jobId = 'test-job-self-heal-2';
    await pg.db.insert(pipelineJobs).values({
      jobId,
      type: 'abm',
      status: 'running',
      progressJson: [
        { step: 1, name: 'Importing Data (ELT)', status: 'running' },
      ],
      logsJson: [
        'Running Transformations & Report...',
        '[ RECONCILIATION SUMMARY REPORT SAVED ]',
        'Process exited with code 0',
      ],
    });

    const progress = await service.getJobProgress(jobId);
    expect(progress.status).toBe('done');

    const [job] = await pg.db
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.jobId, jobId))
      .limit(1);

    expect(job.status).toBe('done');
  });

  it('should clean up zombie running job and start fresh job on executeElt', async () => {
    const runEltCoreSpy = jest
      .spyOn(service, 'runEltCore')
      .mockResolvedValue(undefined as any);
    const oldJobId = 'zombie-job-999';
    await pg.db.insert(pipelineJobs).values({
      jobId: oldJobId,
      type: 'abm',
      status: 'running',
      progressJson: [
        { step: 1, name: 'Importing Data (ELT)', status: 'running' },
      ],
      logsJson: ['Running ABM Extraction...'],
    });

    const res = await service.executeElt({
      source: 'abm',
      skipExtraction: true,
    } as any);

    expect(res.jobId).toBeDefined();
    expect(res.jobId).not.toBe(oldJobId);

    const [oldJob] = await pg.db
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.jobId, oldJobId))
      .limit(1);

    expect(oldJob.status).toBe('failed');
    expect(runEltCoreSpy).toHaveBeenCalledWith(expect.anything(), res.jobId);
  });
});
