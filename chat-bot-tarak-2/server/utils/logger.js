// server/utils/logger.js

const pino = require('pino');

// In a development environment, we want to use pino-pretty for nice, human-readable logs.
// In production, we'll use the standard JSON output for performance and machine readability.
let logger;

if (process.env.NODE_ENV === 'development') {
  // Development logger with pino-pretty
  logger = pino({
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  });
} else {
  // Production logger - writes to files
  const transport = pino.transport({
    targets: [
      {
        level: 'info',
        target: 'pino/file', // Use pino's built-in file transport
        options: { destination: './logs/combined.log' },
      },
      {
        level: 'error',
        target: 'pino/file',
        options: { destination: './logs/error.log' },
      },
    ],
  });

  logger = pino(
    {
      level: 'info', // Default log level
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
    },
    transport
  );
}

module.exports = logger;