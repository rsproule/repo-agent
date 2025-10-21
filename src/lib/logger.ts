import winston from "winston";

export interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}

// Create Winston logger with custom format
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length
        ? JSON.stringify(
            meta,
            (key, value) =>
              typeof value === "bigint" ? value.toString() : value,
            2,
          )
        : "";
      return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
    }),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? "\n" +
              JSON.stringify(
                meta,
                (key, value) =>
                  typeof value === "bigint" ? value.toString() : value,
                2,
              )
            : "";
          return `${timestamp} ${level}: ${message}${metaStr}`;
        }),
      ),
    }),
  ],
});

// Default Winston-based logger
export const defaultLogger: Logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    winstonLogger.info(message, data);
  },
  error: (message: string, data?: Record<string, unknown>) => {
    winstonLogger.error(message, data);
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    winstonLogger.warn(message, data);
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    winstonLogger.debug(message, data);
  },
};

/**
 * Create a logger that wraps Trigger.dev's logger
 * This is useful when running inside a Trigger.dev task
 */
export function createTriggerLogger(triggerLogger: {
  info: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
}): Logger {
  return {
    info: (message: string, data?: Record<string, unknown>) =>
      triggerLogger.info(message, data),
    error: (message: string, data?: Record<string, unknown>) =>
      triggerLogger.error(message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      triggerLogger.warn(message, data),
    debug: (message: string, data?: Record<string, unknown>) =>
      triggerLogger.info(message, data), // Trigger.dev doesn't have debug, use info
  };
}

/**
 * Create a child logger with a specific context
 * Useful for adding metadata to all log messages in a specific module
 */
export function createChildLogger(
  parentLogger: Logger,
  context: Record<string, unknown>,
): Logger {
  return {
    info: (message: string, data?: Record<string, unknown>) => {
      parentLogger.info(message, { ...context, ...data });
    },
    error: (message: string, data?: Record<string, unknown>) => {
      parentLogger.error(message, { ...context, ...data });
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      parentLogger.warn(message, { ...context, ...data });
    },
    debug: (message: string, data?: Record<string, unknown>) => {
      parentLogger.debug(message, { ...context, ...data });
    },
  };
}

// Export a singleton logger instance for use throughout the app
export const logger = defaultLogger;
