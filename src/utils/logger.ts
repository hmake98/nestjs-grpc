import { Logger } from '@nestjs/common';

import { GrpcLogLevel } from './enums';

import type { GrpcLoggerOptions } from '../interfaces';

/**
 * Centralized logging utility for the gRPC module with level-based filtering.
 *
 * Features:
 * - Level-based log filtering (debug, verbose, log, warn, error)
 * - Enable/disable logging
 * - Custom context per logger instance
 * - Child logger creation with nested contexts
 *
 * @example
 * ```typescript
 * // Basic usage
 * const logger = new GrpcLogger({ context: 'AuthService' });
 * logger.log('User authenticated successfully');
 *
 * // With custom level
 * const logger = new GrpcLogger({ level: GrpcLogLevel.DEBUG, context: 'AuthService' });
 * logger.debug('Debugging info');
 *
 * // Child logger for specific operations
 * const childLogger = logger.child('UserManagement');
 * childLogger.log('Processing user request');
 * ```
 */
export class GrpcLogger {
    private readonly logger: Logger;
    private readonly options: Required<GrpcLoggerOptions>;

    /**
     * Creates a new GrpcLogger instance with the specified configuration.
     *
     * @param options - Logger configuration options
     *
     * @example
     * ```typescript
     * // Basic logger with default settings
     * const logger = new GrpcLogger();
     *
     * // Logger with custom context and level
     * const logger = new GrpcLogger({
     *   context: 'AuthService',
     *   level: GrpcLogLevel.DEBUG
     * });
     *
     * // Logger for production with error-only logging
     * const logger = new GrpcLogger({
     *   level: GrpcLogLevel.ERROR
     * });
     * ```
     */
    constructor(options: GrpcLoggerOptions = {}) {
        this.options = {
            enabled: options.enabled ?? true,
            level: options.level ?? GrpcLogLevel.LOG,
            context: options.context ?? 'GrpcModule',
        };

        this.logger = new Logger(this.options.context);
    }

    /**
     * Logs a debug message for development and troubleshooting.
     * Only displayed when log level is set to 'debug'.
     *
     * @param message - The debug message to log
     * @param context - Optional context override for this log entry
     *
     * @example
     * ```typescript
     * logger.debug('Client connection established');
     * logger.debug('Processing request payload', 'RequestHandler');
     * ```
     */
    debug(message: string, context?: string): void {
        if (this.shouldLog(GrpcLogLevel.DEBUG)) {
            if (context && context !== this.options.context) {
                this.logger.debug(message, context);
            } else {
                this.logger.debug(message);
            }
        }
    }

    /**
     * Log a verbose message
     */
    verbose(message: string, context?: string): void {
        if (this.shouldLog(GrpcLogLevel.VERBOSE)) {
            if (context && context !== this.options.context) {
                this.logger.verbose(message, context);
            } else {
                this.logger.verbose(message);
            }
        }
    }

    /**
     * Log a general message
     */
    log(message: string, context?: string): void {
        if (this.shouldLog(GrpcLogLevel.LOG)) {
            if (context && context !== this.options.context) {
                this.logger.log(message, context);
            } else {
                this.logger.log(message);
            }
        }
    }

    /**
     * Log a warning message
     */
    warn(message: string, context?: string): void {
        if (this.shouldLog(GrpcLogLevel.WARN)) {
            if (context && context !== this.options.context) {
                this.logger.warn(message, context);
            } else {
                this.logger.warn(message);
            }
        }
    }

    /**
     * Log an error message
     */
    error(message: string, error?: Error | string, context?: string): void {
        if (this.shouldLog(GrpcLogLevel.ERROR)) {
            const useContext = context && context !== this.options.context ? context : undefined;
            if (error instanceof Error) {
                if (useContext) {
                    this.logger.error(message, error.stack, useContext);
                } else {
                    this.logger.error(message, error.stack);
                }
            } else {
                if (useContext) {
                    this.logger.error(message, error, useContext);
                } else {
                    this.logger.error(message, error);
                }
            }
        }
    }

    /**
     * Check if logging is enabled for the given level
     */
    private shouldLog(level: GrpcLogLevel): boolean {
        if (!this.options.enabled) {
            return false;
        }

        const levels: GrpcLogLevel[] = [
            GrpcLogLevel.DEBUG,
            GrpcLogLevel.VERBOSE,
            GrpcLogLevel.LOG,
            GrpcLogLevel.WARN,
            GrpcLogLevel.ERROR,
        ];
        const currentLevelIndex = levels.indexOf(this.options.level);
        const targetLevelIndex = levels.indexOf(level);

        return targetLevelIndex >= currentLevelIndex;
    }

    /**
     * Creates a child logger with a specialized context for specific operations or components.
     * The child logger inherits all configuration from the parent but uses a nested context.
     *
     * @param context - The specific context to append to the parent context
     * @returns A new GrpcLogger instance with the nested context
     *
     * @example
     * ```typescript
     * const mainLogger = new GrpcLogger({ context: 'GrpcModule' });
     *
     * // Create specialized loggers for different components
     * const authLogger = mainLogger.child('Auth');
     * const userLogger = mainLogger.child('UserService');
     *
     * authLogger.log('User authenticated');
     * // Output context: "GrpcModule:Auth"
     *
     * userLogger.log('User data retrieved');
     * // Output context: "GrpcModule:UserService"
     * ```
     */
    child(context: string): GrpcLogger {
        return new GrpcLogger({
            ...this.options,
            context: `${this.options.context}:${context}`,
        });
    }
}
