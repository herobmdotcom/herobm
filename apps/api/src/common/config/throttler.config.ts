// Centralized rate limiting configuration

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const RATE_LIMITS = {
  // Global fallbacks
  DEFAULT: {
    limit: isProd ? 60 : isTest ? 10000 : 10000,
    ttl: 60000,
  },
  API: {
    limit: isProd ? 1000 : isTest ? 10000 : 10000,
    ttl: 60000,
  },

  // Authentication endpoints
  AUTH_LOGIN: {
    limit: isProd ? 5 : isTest ? 100 : 1000,
    ttl: 60000,
  },
  AUTH_ME: {
    limit: isProd ? 30 : isTest ? 100 : 10000,
    ttl: 60000,
  },
  AUTH_2FA_VERIFY: {
    limit: isProd ? 5 : isTest ? 100 : 1000,
    ttl: 60000,
  },

  // Telemetry endpoint
  TELEMETRY: {
    limit: isProd ? 10 : 10000,
    ttl: 60000,
  },

  // Health endpoint
  HEALTH: {
    limit: isProd ? 120 : 10000,
    ttl: 60000,
  },
};
