import { Logger, LogLevel } from '@nestjs/common';

import { GrpcLoggerOptions } from '../interfaces';

/**
 * Centralized logging utility for the gRPC module with level-based filtering,
 * performance tracking, and detailed request/response logging capabilities.
 *
 * Features:
 * - Level-based log filtering (debug, verbose, log, warn, error)
 * - Performance metrics logging with timing information
 * - Detailed request/response logging for debugging
 * - Service lifecycle event tracking
 * - Method call timing and statistics
 * - Connection event monitoring
 *
 * @example
 * ```typescript
 * // Basic usage
 * const logger = new GrpcLogger({ context: 'AuthService' });
 * logger.log('User authenticated successfully');
 *
 * // Performance logging
 * const logger = new GrpcLogger({ logPerformance: true });
 * logger.performance('Database query', 150);
 *
 * // Method call tracking
 * logger.methodCall('login', 'AuthService', 245);
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
     * // Logger with custom context and performance tracking
     * const logger = new GrpcLogger({
     *   context: 'AuthService',
     *   logPerformance: true,
     *   level: 'debug'
     * });
     *
     * // Logger for production with error-only logging
     * const logger = new GrpcLogger({
     *   level: 'error',
     *   logDetails: false,
     *   logPerformance: false
     * });
     * ```
     */
    constructor(options: GrpcLoggerOptions = {}) {
        this.options = {
            enabled: options.enabled ?? true,
            level: options.level ?? 'log',
            context: options.context ?? 'GrpcModule',
            logErrors: options.logErrors ?? true,
            logPerformance: options.logPerformance ?? false,
            logDetails: options.logDetails ?? false,
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
        if (this.shouldLog('debug')) {
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
        if (this.shouldLog('verbose')) {
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
        if (this.shouldLog('log')) {
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
        if (this.shouldLog('warn')) {
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
        if (this.shouldLog('error') && this.options.logErrors) {
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
     * Logs performance metrics with execution timing information.
     * Only displayed when logPerformance is enabled and log level allows verbose output.
     *
     * @param message - Description of the operation being measured
     * @param duration - Execution time in milliseconds
     * @param context - Optional context override for this log entry
     *
     * @example
     * ```typescript
     * const start = Date.now();
     * await someOperation();
     * const duration = Date.now() - start;
     * logger.performance('Database query', duration);
     *
     * // Output: "Database query (150ms)"
     * ```
     */
    performance(message: string, duration: number, context?: string): void {
        if (this.options.logPerformance && this.shouldLog('verbose')) {
            if (context && context !== this.options.context) {
                this.logger.verbose(`${message} (${duration}ms)`, context);
            } else {
                this.logger.verbose(`${message} (${duration}ms)`);
            }
        }
    }

    /**
     * Logs detailed request/response information with optional data serialization.
     * Only displayed when logDetails is enabled and log level allows debug output.
     *
     * @param message - Description of the detailed information being logged
     * @param data - Optional data object to serialize and include in the log
     * @param context - Optional context override for this log entry
     *
     * @example
     * ```typescript
     * // Log with data
     * logger.detail('Request received', { userId: 123, action: 'login' });
     *
     * // Log without data
     * logger.detail('Processing authentication flow');
     *
     * // Output: "Request received: { "userId": 123, "action": "login" }"
     * ```
     */
    detail(message: string, data?: any, context?: string): void {
        if (this.options.logDetails && this.shouldLog('debug')) {
            const useContext = context && context !== this.options.context ? context : undefined;
            if (data) {
                const detailMessage = `${message}: ${JSON.stringify(data, null, 2)}`;
                if (useContext) {
                    this.logger.debug(detailMessage, useContext);
                } else {
                    this.logger.debug(detailMessage);
                }
            } else {
                if (useContext) {
                    this.logger.debug(message, useContext);
                } else {
                    this.logger.debug(message);
                }
            }
        }
    }

    /**
     * Log service lifecycle events
     */
    lifecycle(event: string, details?: Record<string, any>, context?: string): void {
        const message = details ? `${event} ${JSON.stringify(details)}` : event;
        this.log(message, context);
    }

    /**
     * Logs gRPC method invocations with optional timing information.
     * Helps track service usage patterns and performance characteristics.
     *
     * @param method - Name of the gRPC method being called
     * @param service - Name of the gRPC service containing the method
     * @param duration - Optional execution time in milliseconds
     * @param context - Optional context override for this log entry
     *
     * @example
     * ```typescript
     * // Log method call without timing
     * logger.methodCall('login', 'AuthService');
     *
     * // Log method call with performance timing
     * logger.methodCall('getUserById', 'UserService', 45);
     *
     * // Output: "Method call: UserService.getUserById (45ms)"
     * ```
     */
    methodCall(method: string, service: string, duration?: number, context?: string): void {
        const baseMessage = `Method call: ${service}.${method}`;
        const message = duration ? `${baseMessage} (${duration}ms)` : baseMessage;

        if (duration && this.options.logPerformance) {
            this.verbose(message, context);
        } else {
            this.debug(message, context);
        }
    }

    /**
     * Log connection events
     */
    connection(
        event: string,
        target: string,
        details?: Record<string, any>,
        context?: string,
    ): void {
        const message = details
            ? `${event} to ${target} ${JSON.stringify(details)}`
            : `${event} to ${target}`;
        this.log(message, context);
    }

    /**
     * Check if logging is enabled for the given level
     */
    private shouldLog(level: LogLevel): boolean {
        if (!this.options.enabled) {
            return false;
        }

        const levels: LogLevel[] = ['debug', 'verbose', 'log', 'warn', 'error'];
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
