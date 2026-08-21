export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
  disableClientInfo: boolean;
  keepAlive: number;
  connectTimeout: number;
  retryStrategy: (times: number) => number;
  reconnectOnError: (err: Error) => boolean;
}

/**
 * Returns standardized, resilient BullMQ connection options.
 * Enforces mandatory BullMQ options (maxRetriesPerRequest: null, enableReadyCheck: false)
 * alongside TCP keepalive, bounded connect timeout, and exponential backoff retry/reconnect strategies.
 */
export function getBullMQConnectionOptions(
  host: string = process.env.REDIS_HOST || 'localhost',
  port: number = 6379,
  password?: string
): RedisConnectionOptions {
  return {
    host,
    port,
    password: password || process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    disableClientInfo: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    retryStrategy: (times: number) => {
      return Math.max(Math.min(Math.exp(times), 20000), 1000);
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE'];
      return targetErrors.some(
        (target) => err.message.includes(target) || (err as any).code === target
      );
    },
  };
}
