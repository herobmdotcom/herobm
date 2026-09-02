export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
  disableClientInfo: boolean;
  keepAlive: number;
  connectTimeout: number;
  family: number;
  retryStrategy: (times: number) => number;
  reconnectOnError: (err: Error) => boolean;
}

/**
 * Returns standardized, resilient BullMQ connection options.
 * Enforces mandatory BullMQ options (maxRetriesPerRequest: null)
 * alongside TCP keepalive, IPv4 resolution, ready-check validation for authenticated Redis,
 * bounded connect timeout, and exponential backoff retry/reconnect strategies.
 */
export function getBullMQConnectionOptions(
  host: string = process.env.REDIS_HOST || '127.0.0.1',
  port: number = Number(process.env.REDIS_PORT) || 6379,
  password?: string
): RedisConnectionOptions {
  // Normalize 'localhost' to '127.0.0.1' to prevent Node.js 18+ IPv6 (::1) ECONNREFUSED issues
  const resolvedHost = host === 'localhost' ? '127.0.0.1' : host;
  const resolvedPass = password !== undefined ? password : process.env.REDIS_PASSWORD;

  return {
    host: resolvedHost,
    port,
    ...(resolvedPass ? { password: resolvedPass } : {}),
    maxRetriesPerRequest: null,
    // Must be true when password auth is used so ioredis waits for AUTH response before BullMQ sends commands
    enableReadyCheck: true,
    disableClientInfo: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    family: 4,
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
