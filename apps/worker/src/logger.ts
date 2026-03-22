import pino from 'pino';

/**
 * Structured JSON logger for the Outbox Worker.
 *
 * Produces one-line JSON objects with standard fields:
 *   { level, time, msg, component, ...context }
 *
 * Promtail/Loki automatically parse JSON log lines, enabling:
 *   - Filtering by level (info/warn/error/fatal)
 *   - Correlation by eventId, eventType, jobId
 *   - Grafana alerting on error-level entries
 */
const rootLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/** Logger scoped to the relay polling loop. */
export const relayLogger = rootLogger.child({ component: 'outbox-relay' });

/** Logger scoped to event processing (BullMQ worker). */
export const processingLogger = rootLogger.child({ component: 'event-processor' });

export default rootLogger;
