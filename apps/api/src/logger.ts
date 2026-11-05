import { pino, type Logger } from 'pino';
import type { AppConfig } from './config/env';

export type { Logger };

export function createLogger(config: Pick<AppConfig, 'env' | 'logLevel'>): Logger {
  return pino({
    level: config.env === 'test' ? 'silent' : config.logLevel,
    redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    ...(config.env === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss' },
          },
        }
      : {}),
  });
}
