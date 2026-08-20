import type { Sql } from 'postgres';
import { relayLogger } from './logger';

export interface OutboxListenerOptions {
  subscriberClient: Sql;
  onSweep: () => Promise<void>;
  channels?: string[];
  heartbeatIntervalMs?: number;
  logger?: typeof relayLogger;
}

export class OutboxListener {
  private subscriberClient: Sql;
  private onSweep: () => Promise<void>;
  private channels: string[];
  private heartbeatIntervalMs: number;
  private logger: typeof relayLogger;

  private isSweeping = false;
  private pendingWakeup = false;
  private isStopped = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private subscriptions: { unlisten: () => Promise<void> }[] = [];

  constructor(options: OutboxListenerOptions) {
    this.subscriberClient = options.subscriberClient;
    this.onSweep = options.onSweep;
    this.channels = options.channels || [
      'herobm_outbox_events',
      'herobm_email_outbox_events',
    ];
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 60000;
    this.logger = options.logger || relayLogger;
  }

  /**
   * Triggers a sweep with coalescing.
   * If a sweep is currently running, flags a pending wakeup to immediately
   * run once the active sweep finishes, collapsing multiple notifications.
   */
  public async triggerSweep(): Promise<void> {
    if (this.isStopped) return;

    if (this.isSweeping) {
      this.pendingWakeup = true;
      return;
    }

    this.isSweeping = true;
    try {
      do {
        this.pendingWakeup = false;
        await this.onSweep();
      } while (this.pendingWakeup && !this.isStopped);
    } catch (err) {
      this.logger.error({ err }, 'Error during outbox sweep execution');
    } finally {
      this.isSweeping = false;
    }
  }

  /**
   * Starts listening to Postgres NOTIFY channels and initializes heartbeat.
   */
  public async start(): Promise<void> {
    this.isStopped = false;
    this.logger.info(
      { channels: this.channels, heartbeatIntervalMs: this.heartbeatIntervalMs },
      'Starting OutboxListener with Postgres LISTEN/NOTIFY and fallback heartbeat',
    );

    // Subscribe to each notification channel
    for (const channel of this.channels) {
      try {
        const sub = await this.subscriberClient.listen(
          channel,
          (payload: string) => {
            this.logger.debug(
              { channel, payload },
              'Received Postgres NOTIFY event, triggering sweep',
            );
            void this.triggerSweep();
          },
          () => {
            this.logger.info(
              { channel },
              'Postgres LISTEN subscription established / reconnected',
            );
            // Catch up on any events inserted during disconnected window
            void this.triggerSweep();
          },
        );
        this.subscriptions.push(sub);
      } catch (err) {
        this.logger.error(
          { err, channel },
          'Failed to subscribe to notification channel',
        );
      }
    }

    // Set up heartbeat fallback timer to catch any missed events during network drops
    if (this.heartbeatIntervalMs > 0) {
      this.heartbeatTimer = setInterval(() => {
        this.logger.debug('OutboxListener fallback heartbeat tick');
        void this.triggerSweep();
      }, this.heartbeatIntervalMs);
    }

    // Run initial catch-up sweep
    await this.triggerSweep();
  }

  /**
   * Stops subscriptions and cleans up heartbeat timer.
   */
  public async stop(): Promise<void> {
    this.isStopped = true;
    this.logger.info('Stopping OutboxListener...');

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const sub of this.subscriptions) {
      try {
        await sub.unlisten();
      } catch (err) {
        this.logger.warn({ err }, 'Error unlistening from channel');
      }
    }
    this.subscriptions = [];
  }
}
