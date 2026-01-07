import { ArgumentsHost, Catch, RpcExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

import {
    GrpcErrorCode,
    DEFAULT_MAX_ERROR_MESSAGE_LENGTH,
    DEFAULT_FALLBACK_ERROR_MESSAGE,
} from '../constants';
import {
    type GrpcExceptionFilterOptions,
    type GrpcErrorResponse,
    GrpcLogLevel,
} from '../interfaces';
import { GrpcLogger } from '../utils/logger';

import { GrpcException } from './grpc.exception';

/**
 * Global exception filter for gRPC services
 */
@Catch()
export class GrpcExceptionFilter implements RpcExceptionFilter<any> {
    private readonly logger: GrpcLogger;
    private readonly options: Required<GrpcExceptionFilterOptions>;

    constructor(options: GrpcExceptionFilterOptions = {}) {
        this.options = {
            enableLogging: options.enableLogging ?? true,
            maxMessageLength: options.maxMessageLength ?? DEFAULT_MAX_ERROR_MESSAGE_LENGTH,
            fallbackMessage: options.fallbackMessage ?? DEFAULT_FALLBACK_ERROR_MESSAGE,
            fallbackCode: options.fallbackCode ?? GrpcErrorCode.INTERNAL,
        };

        this.logger = new GrpcLogger({
            enabled: this.options.enableLogging,
            level: GrpcLogLevel.ERROR,
            context: 'GrpcExceptionFilter',
        });
    }

    /**
     * Catch and handle exceptions in gRPC calls
     */
    catch(exception: any, _host: ArgumentsHost): Observable<any> {
        try {
            const error = this.normalizeError(exception);

            if (this.options.enableLogging) {
                this.logError(error, exception);
            }

            return throwError(() => error);
        } catch (filterError) {
            // Fallback if normalization fails
            if (this.options.enableLogging) {
                this.logger.error('Exception filter failed to process error', filterError);
                this.logger.warn('Using fallback error response');
            }

            const fallbackError: GrpcErrorResponse = {
                code: this.options.fallbackCode,
                message: this.options.fallbackMessage,
                details: {
                    originalError: String(exception),
                    filterError: String(filterError),
                },
            };

            return throwError(() => fallbackError);
        }
    }

    /**
     * Normalizes different types of errors to gRPC format
     */
    private normalizeError(exception: any): GrpcErrorResponse {
        // If it's already a GrpcException, extract its data
        if (exception instanceof GrpcException) {
            return this.extractGrpcException(exception);
        }

        // If it's a NestJS RpcException, try to extract gRPC data
        if (this.isRpcException(exception)) {
            return this.extractRpcException(exception);
        }

        // Handle standard Error objects
        if (exception instanceof Error) {
            return this.extractErrorObject(exception);
        }

        // Handle unknown error types
        return this.extractUnknownError(exception);
    }

    /**
     * Extracts data from GrpcException
     */
    private extractGrpcException(exception: GrpcException): GrpcErrorResponse {
        return {
            code: exception.getCode(),
            message: this.truncateMessage(exception.message),
            details: exception.getDetails(),
            metadata: exception.getMetadata(),
        };
    }

    /**
     * Checks if exception is a NestJS RpcException
     */
    private isRpcException(exception: any): boolean {
        return (
            exception != null &&
            typeof exception === 'object' &&
            typeof exception.getError === 'function'
        );
    }

    /**
     * Extracts data from NestJS RpcException
     */
    private extractRpcException(exception: any): GrpcErrorResponse {
        try {
            const error = exception.getError();

            if (!error || typeof error !== 'object') {
                return this.extractUnknownError(exception.message ?? exception);
            }

            return {
                code: this.isValidGrpcCode(error.code) ? error.code : GrpcErrorCode.INTERNAL,
                message: this.truncateMessage(
                    error.message ?? exception.message ?? 'Internal server error',
                ),
                details: error.details,
                metadata: error.metadata,
            };
        } catch {
            return this.extractUnknownError(exception);
        }
    }

    /**
     * Validates if a value is a valid gRPC error code
     */
    private isValidGrpcCode(code: any): boolean {
        return (
            typeof code === 'number' &&
            code >= 0 &&
            code <= 16 &&
            Object.values(GrpcErrorCode).includes(code)
        );
    }

    /**
     * Extracts data from standard Error objects
     */
    private extractErrorObject(exception: Error): GrpcErrorResponse {
        return {
            code: GrpcErrorCode.INTERNAL,
            message: this.truncateMessage(exception.message ?? 'Internal server error'),
            details: {
                name: exception.name ?? 'Error',
                stack: exception.stack,
            },
        };
    }

    /**
     * Extracts data from unknown error types
     */
    private extractUnknownError(exception: any): GrpcErrorResponse {
        const message =
            typeof exception === 'string'
                ? exception
                : typeof exception === 'object'
                  ? (exception.message ?? JSON.stringify(exception))
                  : String(exception);

        return {
            code: GrpcErrorCode.INTERNAL,
            message: this.truncateMessage(message ?? 'Unknown error occurred'),
            details: {
                originalError: this.makeSafeForSerialization(exception),
            },
        };
    }

    /**
     * Logs error information with structured format
     */
    private logError(error: GrpcErrorResponse, _originalException: any): void {
        try {
            // Log main error with code
            const errorMessage = `gRPC error [Code: ${error.code}]: ${error.message}`;
            this.logger.error(errorMessage);

            // Log additional details if available and serializable
            if (error.details && typeof error.details === 'object') {
                const detailsString = this.safeSerializeDetails(error.details);
                if (detailsString) {
                    this.logger.debug(`Error details: ${detailsString}`);
                }
            }
        } catch (loggingError) {
            // Fallback logging if main error logging fails
            this.logger.warn('Failed to log error details', String(loggingError));
        }
    }

    /**
     * Safely serializes error details to JSON string
     */
    private safeSerializeDetails(details: any): string {
        try {
            // Create a safe copy to avoid circular references
            const safeDetails = this.makeSafeForSerialization(details);
            const serialized = JSON.stringify(safeDetails);

            // Truncate if too long
            if (serialized.length > this.options.maxMessageLength) {
                return `${serialized.substring(0, this.options.maxMessageLength)}...`;
            }

            return serialized;
        } catch {
            // If serialization fails, try to extract useful information
            try {
                const typeInfo = Object.prototype.toString.call(details);
                return `[${typeInfo}] - Unable to serialize`;
            } catch {
                return '[Unknown] - Unable to serialize';
            }
        }
    }

    /**
     * Creates a safe copy of object for JSON serialization
     */
    private makeSafeForSerialization(obj: any, visited = new WeakSet()): any {
        // Handle primitive types
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        // Detect circular references
        if (visited.has(obj)) {
            return '[Circular Reference]';
        }

        visited.add(obj);

        // Handle arrays
        if (Array.isArray(obj)) {
            return obj
                .slice(0, 10) // Limit array size
                .map(item => this.makeSafeForSerialization(item, visited));
        }

        // Handle objects
        const safeObj: Record<string, any> = {};
        const keys = Object.keys(obj).slice(0, 10); // Limit object keys

        for (const key of keys) {
            try {
                const value = obj[key];
                safeObj[key] = this.makeSafeForSerialization(value, visited);
            } catch {
                safeObj[key] = '[Error reading property]';
            }
        }

        return safeObj;
    }

    /**
     * Truncates error messages to prevent excessive logging
     */
    private truncateMessage(message: string): string {
        if (!message || typeof message !== 'string') {
            return 'Unknown error';
        }

        const trimmed = message.trim();
        return trimmed.length > this.options.maxMessageLength
            ? `${trimmed.substring(0, this.options.maxMessageLength)}...`
            : trimmed;
    }
}
