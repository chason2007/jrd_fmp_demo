import winston from 'winston';
import { env } from '../config/env.js';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }), // Automatically append error stacks
  env.NODE_ENV === 'production'
    ? winston.format.json() // Output JSON in production for log forwarders (elastic, log analytics)
    : winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`
        )
      )
);

const transports = [
  new winston.transports.Console(),
];

// Fallback error and combined logs for production disk backup.
// Rotation caps (maxsize + maxFiles) keep these from growing unbounded and
// filling the disk — which on a self-hosted box would take the app down.
if (env.NODE_ENV === 'production') {
  const rotation = { maxsize: 10 * 1024 * 1024, maxFiles: 5, tailable: true };
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json(),
      ...rotation,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json(),
      ...rotation,
    })
  );
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format,
  transports,
});
