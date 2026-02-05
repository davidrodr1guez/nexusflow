/**
 * Structured logger for the NexusFlow agent.
 * Uses pino for structured JSON logging in production,
 * falls back to console with colors in development.
 */

import type { AgentLog, LogLevel } from '../types.js';

const LOG_COLORS: Record<LogLevel, string> = {
  monitor: '\x1b[34m', // Blue
  decide: '\x1b[33m',  // Yellow
  execute: '\x1b[32m', // Green
  error: '\x1b[31m',   // Red
};

const RESET = '\x1b[0m';

const isDev = process.env.NODE_ENV !== 'production';

export function createLogger(module: string) {
  const prefix = `[${module}]`;

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>): AgentLog => {
    const entry: AgentLog = {
      timestamp: new Date(),
      level,
      message,
      metadata: { module, ...meta },
    };

    if (isDev) {
      const color = LOG_COLORS[level];
      const time = entry.timestamp.toISOString().slice(11, 23);
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      console.log(`${color}${time} ${level.toUpperCase().padEnd(7)} ${prefix} ${message}${metaStr}${RESET}`);
    } else {
      // In production, output structured JSON
      console.log(JSON.stringify(entry));
    }

    return entry;
  };

  return {
    info: (message: string, meta?: Record<string, unknown>) => log('monitor', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('decide', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
    monitor: (message: string, meta?: Record<string, unknown>) => log('monitor', message, meta),
    decide: (message: string, meta?: Record<string, unknown>) => log('decide', message, meta),
    execute: (message: string, meta?: Record<string, unknown>) => log('execute', message, meta),
  };
}
