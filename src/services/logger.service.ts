import { Injectable } from '@nestjs/common';
import { Logger as NestLogger } from '@nestjs/common';
import { GrpcLogger, LogLevel } from '../interfaces/logger.interface';

/**
 * Default logger service for the gRPC module
 */
@Injectable()
export class GrpcLoggerService implements GrpcLogger {
    private logLevel: LogLevel = LogLevel.INFO;
    private readonly nestLogger: NestLogger;
    private readonly prettyPrint: boolean;
    private readonly disabled: boolean;

    /**
     * Creates a new logger service
     * @param context The logger context
     * @param options Options for the logger
     */
    constructor(
        private readonly context: string = 'GrpcModule',
        options?: {
            level?: LogLevel;
            prettyPrint?: boolean;
            disable?: boolean;
        },
    ) {
        this.nestLogger = new NestLogger(context);
        this.logLevel = options?.level ?? LogLevel.INFO;
        this.prettyPrint = options?.prettyPrint ?? true;
        this.disabled = options?.disable ?? false;
    }

    /**
     * Log an error message
     * @param message The message to log
     * @param context Optional context
     * @param trace Optional stack trace
     */
    error(message: string, context?: string, trace?: string): void {
        if (this.disabled || this.logLevel < LogLevel.ERROR) {
            return;
        }

        const formattedMessage = this.formatMessage('ERROR', message, context);
        this.nestLogger.error(formattedMessage, trace);
    }

    /**
     * Log a warning message
     * @param message The message to log
     * @param context Optional context
     */
    warn(message: string, context?: string): void {
        if (this.disabled || this.logLevel < LogLevel.WARN) {
            return;
        }

        const formattedMessage = this.formatMessage('WARN', message, context);
        this.nestLogger.warn(formattedMessage);
    }

    /**
     * Log an info message
     * @param message The message to log
     * @param context Optional context
     */
    info(message: string, context?: string): void {
        if (this.disabled || this.logLevel < LogLevel.INFO) {
            return;
        }

        const formattedMessage = this.formatMessage('INFO', message, context);
        this.nestLogger.log(formattedMessage);
    }

    /**
     * Log a debug message
     * @param message The message to log
     * @param context Optional context
     */
    debug(message: string, context?: string): void {
        if (this.disabled || this.logLevel < LogLevel.DEBUG) {
            return;
        }

        const formattedMessage = this.formatMessage('DEBUG', message, context);
        this.nestLogger.debug(formattedMessage);
    }

    /**
     * Log a verbose message
     * @param message The message to log
     * @param context Optional context
     */
    verbose(message: string, context?: string): void {
        if (this.disabled || this.logLevel < LogLevel.VERBOSE) {
            return;
        }

        const formattedMessage = this.formatMessage('VERBOSE', message, context);
        this.nestLogger.verbose(formattedMessage);
    }

    /**
     * Set the log level
     * @param level The log level
     */
    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Format a log message
     * @param level The log level
     * @param message The message
     * @param context Optional context
     * @returns Formatted message
     */
    private formatMessage(level: string, message: string, context?: string): string {
        if (!this.prettyPrint) {
            return message;
        }

        const ctx = context || this.context;
        return `[${level}] [${ctx}] ${message}`;
    }
}
