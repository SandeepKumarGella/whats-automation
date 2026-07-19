import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

const logDir = 'logs';

// Ensure directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Event emitter to broadcast logs to SSE streams
export const logEmitter = new EventEmitter();

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    const formattedMsg = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    // Emit the log event for real-time frontend streaming
    logEmitter.emit('log', { timestamp, level, message: formattedMsg });
    return formattedMsg;
  })
);

export const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'logs.txt'),
      options: { flags: 'a' } // Append mode
    })
  ]
});

// Helper to log automation transitions
export const logStep = (stepName: string) => {
  logger.info(`Step: ${stepName}`);
};
