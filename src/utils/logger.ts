/**
 * Logger Utility
 *
 * Structured logging using Firebase Functions logger
 * Provides consistent log formatting across the application
 */

import { logger } from "firebase-functions/v2";

export interface LogContext {
    userId?: string;
    requestId?: string;
    functionName?: string;
    [key: string]: unknown;
}

/**
 * Log an informational message
 */
export function logInfo(message: string, context?: LogContext): void {
    logger.info(message, context);
}

/**
 * Log a warning message
 */
export function logWarn(message: string, context?: LogContext): void {
    logger.warn(message, context);
}

/**
 * Log an error message
 */
export function logError(message: string, error?: Error, context?: LogContext): void {
    const errorDetails =
        error instanceof Error
            ? {
                  errorName: error.name,
                  errorMessage: error.message,
                  errorStack: error.stack,
              }
            : { error: String(error) };

    logger.error(message, { ...context, ...errorDetails });
}

/**
 * Log a debug message (only in development)
 */
export function logDebug(message: string, context?: LogContext): void {
    if (process.env["NODE_ENV"] === "development") {
        logger.debug(message, context);
    }
}

/**
 * Log a business event (token deduction, file extraction, etc.)
 */
export function logEvent(eventName: string, eventData: Record<string, unknown>): void {
    logger.info(`Event: ${eventName}`, {
        event: eventName,
        ...eventData,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Create a logger with a specific context
 * Useful for attaching requestId or userId to all logs in a request
 */
export function createContextLogger(baseContext: LogContext): {
    info: (message: string, context?: LogContext) => void;
    warn: (message: string, context?: LogContext) => void;
    error: (message: string, error?: Error, context?: LogContext) => void;
    debug: (message: string, context?: LogContext) => void;
    event: (eventName: string, eventData: Record<string, unknown>) => void;
} {
    return {
        info: (message: string, context?: LogContext) =>
            logInfo(message, { ...baseContext, ...context }),
        warn: (message: string, context?: LogContext) =>
            logWarn(message, { ...baseContext, ...context }),
        error: (message: string, error?: Error, context?: LogContext) =>
            logError(message, error, { ...baseContext, ...context }),
        debug: (message: string, context?: LogContext) =>
            logDebug(message, { ...baseContext, ...context }),
        event: (eventName: string, eventData: Record<string, unknown>) =>
            logEvent(eventName, { ...baseContext, ...eventData }),
    };
}
