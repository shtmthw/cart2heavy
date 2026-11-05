import type { AppConfig } from './config/env';
import type { Logger } from './logger';

/** Everything a module needs from the outside world. Built once in createApp. */
export interface AppContext {
  config: AppConfig;
  logger: Logger;
}
