import { Logger, LogLevel } from '@nestjs/common';

/**
 * Logger configuration options
 */
export interface GrpcLoggerOptions {
    /**
     * Enable/disable logging
     * @default true
     */
    enabled?: boolean;

    /**
     * Log level (debug, verbose, log, warn, error)
     * @default 'log'
     */
    level?: LogLevel;

    /**
     * Custom context for logger
     * @default 'GrpcModule'
     */
    context?: string;

    /**
     * Enable debug logging (legacy compatibility)
     * @default false
     * @deprecated Use level: 'debug' instead
     */
    debug?: boolean;

    /**
     * Enable error logging
     * @default true
     */
    logErrors?: boolean;

    /**
     * Enable performance logging
     * @default false
     */
    logPerformance?: boolean;

    /**
     * Enable detailed request/response logging
     * @default false
     */
    logDetails?: boolean;
}

/**
 * Central logger for the gRPC module with configurable levels
 */
export class GrpcLogger {
    private readonly logger: Logger;
    private readonly options: Required<GrpcLoggerOptions>;

    constructor(options: GrpcLoggerOptions = {}) {
        this.options = {
            enabled: options.enabled ?? true,
            level: options.level ?? (options.debug ? 'debug' : 'log'),
            context: options.context ?? 'GrpcModule',
            debug: options.debug ?? false,
            logErrors: options.logErrors ?? true,
            logPerformance: options.logPerformance ?? false,
            logDetails: options.logDetails ?? false,
        };

        this.logger = new Logger(this.options.context);
    }

    /**
     * Log a debug message
     */
    debug(message: string, context?: string): void {
        if (this.shouldLog('debug')) {
            this.logger.debug(message, context);
        }
    }

    /**
     * Log a verbose message
     */
    verbose(message: string, context?: string): void {
        if (this.shouldLog('verbose')) {
            this.logger.verbose(message, context);
        }
    }

    /**
     * Log a general message
     */
    log(message: string, context?: string): void {
        if (this.shouldLog('log')) {
            this.logger.log(message, context);
        }
    }

    /**
     * Log a warning message
     */
    warn(message: string, context?: string): void {
        if (this.shouldLog('warn')) {
            this.logger.warn(message, context);
        }
    }

    /**
     * Log an error message
     */
    error(message: string, error?: Error | string, context?: string): void {
        if (this.shouldLog('error') && this.options.logErrors) {
            if (error instanceof Error) {
                this.logger.error(message, error.stack, context);
            } else {
                this.logger.error(message, error, context);
            }
        }
    }

    /**
     * Log performance metrics
     */
    performance(message: string, duration: number, context?: string): void {
        if (this.options.logPerformance && this.shouldLog('verbose')) {
            this.logger.verbose(`${message} (${duration}ms)`, context);
        }
    }

    /**
     * Log detailed request/response information
     */
    detail(message: string, data?: any, context?: string): void {
        if (this.options.logDetails && this.shouldLog('debug')) {
            if (data) {
                this.logger.debug(`${message}: ${JSON.stringify(data, null, 2)}`, context);
            } else {
                this.logger.debug(message, context);
            }
        }
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
     * Create a child logger with a different context
     */
    child(context: string): GrpcLogger {
        return new GrpcLogger({
            ...this.options,
            context: `${this.options.context}:${context}`,
        });
    }

    /**
     * Get current logger options
     */
    getOptions(): Readonly<GrpcLoggerOptions> {
        return { ...this.options };
    }

    /**
     * Check if logging is enabled
     */
    isEnabled(): boolean {
        return this.options.enabled;
    }

    /**
     * Check if error logging is enabled
     */
    isErrorLoggingEnabled(): boolean {
        return this.options.logErrors;
    }

    /**
     * Check if performance logging is enabled
     */
    isPerformanceLoggingEnabled(): boolean {
        return this.options.logPerformance;
    }

    /**
     * Check if detailed logging is enabled
     */
    isDetailLoggingEnabled(): boolean {
        return this.options.logDetails;
    }
}
