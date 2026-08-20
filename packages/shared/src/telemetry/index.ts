import { metrics, trace, Meter, Tracer } from '@opentelemetry/api';

/**
 * Standard OpenTelemetry telemetry sockets for HeroBM.
 * These utilize standard @opentelemetry/api global getters.
 * If no external OpenTelemetry SDK/exporter is initialized,
 * these act as zero-overhead No-Op instruments.
 */
export function getMeter(name = 'herobm', version = '1.0.0'): Meter {
  return metrics.getMeter(name, version);
}

export function getTracer(name = 'herobm', version = '1.0.0'): Tracer {
  return trace.getTracer(name, version);
}

export { metrics, trace, SpanStatusCode, ValueType } from '@opentelemetry/api';
export type { Meter, Tracer, Counter, Histogram, UpDownCounter, Span } from '@opentelemetry/api';
