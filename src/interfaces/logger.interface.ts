/**
 * Supported log levels
 */
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    VERBOSE = 4,
}

/**
 * Logger interface for the gRPC module
 */
export interface GrpcLogger {
    /**
     * Log an error message
     * @param message The message to log
     * @param context Optional context
     * @param trace Optional stack trace
     */
    error(message: string, context?: string, trace?: string): void;

    /**
     * Log a warning message
     * @param message The message to log
     * @param context Optional context
     */
    warn(message: string, context?: string): void;

    /**
     * Log an info message
     * @param message The message to log
     * @param context Optional context
     */
    info(message: string, context?: string): void;

    /**
     * Log a debug message
     * @param message The message to log
     * @param context Optional context
     */
    debug(message: string, context?: string): void;

    /**
     * Log a verbose message
     * @param message The message to log
     * @param context Optional context
     */
    verbose(message: string, context?: string): void;

    /**
     * Set the log level
     * @param level The log level
     */
    setLogLevel(level: LogLevel): void;
}

/**
 * Options for the logger
 */
export interface GrpcLoggerOptions {
    /**
     * Log level for the logger
     * @default LogLevel.INFO
     */
    level?: LogLevel;

    /**
     * Custom logger instance that implements GrpcLogger interface
     */
    customLogger?: GrpcLogger;

    /**
     * Whether to pretty print logs
     * @default true
     */
    prettyPrint?: boolean;

    /**
     * Whether to disable all logging
     * @default false
     */
    disable?: boolean;
}
