import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutboxListener } from './outbox-listener';

describe('OutboxListener', () => {
  let mockSubscriberClient: any;
  let mockLogger: any;
  let sweepCallCount: number;
  let sweepPromiseResolvers: (() => void)[];

  beforeEach(() => {
    sweepCallCount = 0;
    sweepPromiseResolvers = [];

    mockSubscriberClient = {
      listen: vi.fn().mockImplementation(async (channel: string, onNotify: Function, onConnect: Function) => {
        return {
          unlisten: vi.fn().mockResolvedValue(undefined),
        };
      }),
    };

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should subscribe to channels, start heartbeat, and perform initial sweep on start()', async () => {
    const onSweep = vi.fn().mockResolvedValue(undefined);

    const listener = new OutboxListener({
      subscriberClient: mockSubscriberClient,
      onSweep,
      channels: ['chan1', 'chan2'],
      heartbeatIntervalMs: 5000,
      logger: mockLogger,
    });

    await listener.start();

    expect(mockSubscriberClient.listen).toHaveBeenCalledTimes(2);
    expect(mockSubscriberClient.listen).toHaveBeenCalledWith('chan1', expect.any(Function), expect.any(Function));
    expect(mockSubscriberClient.listen).toHaveBeenCalledWith('chan2', expect.any(Function), expect.any(Function));
    expect(onSweep).toHaveBeenCalledTimes(1);

    await listener.stop();
  });

  it('should coalesce rapid simultaneous notifications into exactly two sweeps (1 in-flight + 1 queued)', async () => {
    let activeSweeps = 0;
    let maxConcurrentSweeps = 0;

    const onSweep = vi.fn().mockImplementation(async () => {
      activeSweeps++;
      maxConcurrentSweeps = Math.max(maxConcurrentSweeps, activeSweeps);
      sweepCallCount++;
      // Simulate asynchronous I/O duration
      await new Promise((resolve) => setTimeout(resolve, 30));
      activeSweeps--;
    });

    const listener = new OutboxListener({
      subscriberClient: mockSubscriberClient,
      onSweep,
      channels: ['chan1'],
      heartbeatIntervalMs: 0, // disable heartbeat for this test
      logger: mockLogger,
    });

    // Start 1st sweep (in-flight)
    const p1 = listener.triggerSweep();

    // Trigger 5 rapid subsequent notifications while p1 is in-flight
    listener.triggerSweep();
    listener.triggerSweep();
    listener.triggerSweep();
    listener.triggerSweep();
    listener.triggerSweep();

    await p1;

    // Wait for the coalesced follow-up sweep to complete
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Must never have more than 1 sweep executing concurrently
    expect(maxConcurrentSweeps).toBe(1);
    // 6 triggers collapsed cleanly into 2 sweeps (1 initial + 1 follow-up)
    expect(sweepCallCount).toBe(2);

    await listener.stop();
  });

  it('should gracefully handle and log errors thrown during onSweep without throwing uncaught rejections', async () => {
    const error = new Error('Database connection timeout');
    const onSweep = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);

    const listener = new OutboxListener({
      subscriberClient: mockSubscriberClient,
      onSweep,
      channels: ['chan1'],
      heartbeatIntervalMs: 0,
      logger: mockLogger,
    });

    // Trigger sweep with error
    await listener.triggerSweep();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: error }),
      'Error during outbox sweep execution',
    );

    // Ensure subsequent sweeps still succeed
    await listener.triggerSweep();
    expect(onSweep).toHaveBeenCalledTimes(2);

    await listener.stop();
  });

  it('should clean up subscriptions and heartbeat timer on stop()', async () => {
    const unlisten1 = vi.fn().mockResolvedValue(undefined);
    const unlisten2 = vi.fn().mockResolvedValue(undefined);

    mockSubscriberClient.listen
      .mockResolvedValueOnce({ unlisten: unlisten1 })
      .mockResolvedValueOnce({ unlisten: unlisten2 });

    const onSweep = vi.fn().mockResolvedValue(undefined);

    const listener = new OutboxListener({
      subscriberClient: mockSubscriberClient,
      onSweep,
      channels: ['chan1', 'chan2'],
      heartbeatIntervalMs: 1000,
      logger: mockLogger,
    });

    await listener.start();
    await listener.stop();

    expect(unlisten1).toHaveBeenCalledTimes(1);
    expect(unlisten2).toHaveBeenCalledTimes(1);
  });
});
