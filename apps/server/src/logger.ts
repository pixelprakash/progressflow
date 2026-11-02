import { pino } from 'pino';
import { isDev } from './config.js';

export const logger = pino(
  isDev
    ? { level: 'debug', transport: { target: 'pino/file', options: { destination: 1 } } }
    : { level: 'info' },
);
