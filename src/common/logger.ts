import { AsyncLocalStorage } from 'async_hooks';

export const correlationStore = new AsyncLocalStorage<Map<string, string>>();

function getCorrelationId(): string {
  const store = correlationStore.getStore();
  return store?.get('correlationId') || 'system-background';
}

export const structuredLogger = {
  log(message: string, context?: string) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      context,
      correlationId: getCorrelationId(),
      timestamp: new Date().toISOString()
    }));
  },
  error(message: string, trace?: string, context?: string) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      trace,
      context,
      correlationId: getCorrelationId(),
      timestamp: new Date().toISOString()
    }));
  },
  warn(message: string, context?: string) {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      context,
      correlationId: getCorrelationId(),
      timestamp: new Date().toISOString()
    }));
  },
  debug(message: string, context?: string) {
    console.debug(JSON.stringify({
      level: 'debug',
      message,
      context,
      correlationId: getCorrelationId(),
      timestamp: new Date().toISOString()
    }));
  },
  verbose(message: string, context?: string) {
    console.log(JSON.stringify({
      level: 'verbose',
      message,
      context,
      correlationId: getCorrelationId(),
      timestamp: new Date().toISOString()
    }));
  }
};