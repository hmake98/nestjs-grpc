import { Metadata } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

import { GrpcErrorCode } from '../constants';
import { GrpcConsumerError, GrpcExceptionOptions } from '../interfaces';
import { GrpcLogger } from '../utils/logger';

/**
 * Status codes that are considered retryable
 */
export const RETRYABLE_STATUS_CODES = [
    GrpcErrorCode.UNAVAILABLE,
    GrpcErrorCode.DEADLINE_EXCEEDED,
    GrpcErrorCode.RESOURCE_EXHAUSTED,
    GrpcErrorCode.ABORTED,
    GrpcErrorCode.INTERNAL,
];

/**
 * Gets human-readable error description for gRPC status codes
 */
export function getGrpcStatusDescription(code: number): string {
    switch (code) {
        case GrpcErrorCode.OK:
            return 'Success';
        case GrpcErrorCode.CANCELLED:
            return 'Operation was cancelled';
        case GrpcErrorCode.UNKNOWN:
            return 'Unknown error';
        case GrpcErrorCode.INVALID_ARGUMENT:
            return 'Invalid argument provided';
        case GrpcErrorCode.DEADLINE_EXCEEDED:
            return 'Request timeout exceeded';
        case GrpcErrorCode.NOT_FOUND:
            return 'Resource not found';
        case GrpcErrorCode.ALREADY_EXISTS:
            return 'Resource already exists';
        case GrpcErrorCode.PERMISSION_DENIED:
            return 'Permission denied';
        case GrpcErrorCode.RESOURCE_EXHAUSTED:
            return 'Resource exhausted';
        case GrpcErrorCode.FAILED_PRECONDITION:
            return 'Failed precondition';
        case GrpcErrorCode.ABORTED:
            return 'Operation aborted';
        case GrpcErrorCode.OUT_OF_RANGE:
            return 'Value out of range';
        case GrpcErrorCode.UNIMPLEMENTED:
            return 'Method not implemented';
        case GrpcErrorCode.INTERNAL:
            return 'Internal server error';
        case GrpcErrorCode.UNAVAILABLE:
            return 'Service unavailable';
        case GrpcErrorCode.DATA_LOSS:
            return 'Data loss';
        case GrpcErrorCode.UNAUTHENTICATED:
            return 'Authentication required';
        default:
            return `Unknown status code: ${code}`;
    }
}

/**
 * Maps HTTP status codes to gRPC status codes
 */
export function httpStatusToGrpcStatus(httpStatus: number): number {
    switch (httpStatus) {
        case 200:
            return GrpcErrorCode.OK;
        case 400:
            return GrpcErrorCode.INVALID_ARGUMENT;
        case 401:
            return GrpcErrorCode.UNAUTHENTICATED;
        case 403:
            return GrpcErrorCode.PERMISSION_DENIED;
        case 404:
            return GrpcErrorCode.NOT_FOUND;
        case 409:
            return GrpcErrorCode.ALREADY_EXISTS;
        case 412:
            return GrpcErrorCode.FAILED_PRECONDITION;
        case 416:
            return GrpcErrorCode.OUT_OF_RANGE;
        case 429:
            return GrpcErrorCode.RESOURCE_EXHAUSTED;
        case 499:
            return GrpcErrorCode.CANCELLED;
        case 500:
            return GrpcErrorCode.INTERNAL;
        case 501:
            return GrpcErrorCode.UNIMPLEMENTED;
        case 503:
            return GrpcErrorCode.UNAVAILABLE;
        case 504:
            return GrpcErrorCode.DEADLINE_EXCEEDED;
        default:
            return GrpcErrorCode.UNKNOWN;
    }
}

/**
 * Consumer-specific gRPC exception with retry capability
 */
export class GrpcConsumerException extends Error {
    public readonly error: GrpcConsumerError;

    constructor(error: GrpcConsumerError) {
        super(error.message);
        this.error = error;
        this.name = 'GrpcConsumerException';
    }

    /**
     * Check if this error is retryable
     */
    isRetryable(): boolean {
        return RETRYABLE_STATUS_CODES.includes(this.error.code);
    }

    /**
     * Get the gRPC status code
     */
    getCode(): number {
        return this.error.code;
    }

    /**
     * Get the error details
     */
    getDetails(): any {
        return this.error.details;
    }

    /**
     * Get the error metadata
     */
    getMetadata(): any {
        return this.error.metadata;
    }

    /**
     * Get service name
     */
    getServiceName(): string {
        return this.error.serviceName;
    }

    /**
     * Get method name
     */
    getMethodName(): string {
        return this.error.methodName;
    }

    /**
     * Get error duration
     */
    getDuration(): number {
        return this.error.duration;
    }

    /**
     * Get error timestamp
     */
    getTimestamp(): Date {
        return this.error.timestamp;
    }
}

/**
 * gRPC consumer error handler service
 */
@Injectable()
export class GrpcConsumerErrorHandler {
    private readonly logger = new GrpcLogger({ context: 'GrpcConsumerErrorHandler' });

    /**
     * Handles gRPC errors and converts them to consumer exceptions
     */
    handleError(
        error: any,
        serviceName: string,
        methodName: string,
        startTime: number,
    ): GrpcConsumerException {
        const duration = Date.now() - startTime;
        const timestamp = new Date();

        // Extract gRPC error information
        const grpcError = this.extractGrpcError(error);

        const consumerError: GrpcConsumerError = {
            code: grpcError.code,
            message: grpcError.message,
            serviceName,
            methodName,
            details: grpcError.details,
            metadata: grpcError.metadata,
            timestamp,
            duration,
        };

        // Log the error
        this.logError(consumerError, error);

        return new GrpcConsumerException(consumerError);
    }

    /**
     * Extracts gRPC error information from various error types
     */
    private extractGrpcError(error: any): {
        code: number;
        message: string;
        details?: any;
        metadata?: any;
    } {
        // Handle gRPC errors
        if (error && typeof error.code === 'number') {
            return {
                code: error.code,
                message: error.message ?? error.details ?? 'gRPC error',
                details: error.details,
                metadata: error.metadata,
            };
        }

        // Handle standard errors
        if (error instanceof Error) {
            return {
                code: GrpcErrorCode.INTERNAL,
                message: error.message || 'Internal error',
                details: error.stack,
            };
        }

        // Handle string errors
        if (typeof error === 'string') {
            return {
                code: GrpcErrorCode.UNKNOWN,
                message: error,
            };
        }

        // Handle unknown errors
        return {
            code: GrpcErrorCode.UNKNOWN,
            message: 'Unknown error occurred',
            details: error,
        };
    }

    /**
     * Logs error information appropriately based on error type
     */
    private logError(consumerError: GrpcConsumerError, originalError: any): void {
        // Log data for debugging (kept for future needs)
        const _logData = {
            service: consumerError.serviceName,
            method: consumerError.methodName,
            code: consumerError.code,
            duration: `${consumerError.duration}ms`,
            timestamp: consumerError.timestamp.toISOString(),
        };

        // Log level based on error type
        if (consumerError.code === GrpcErrorCode.CANCELLED) {
            // Cancelled operations are usually not errors
            this.logger.debug(
                `gRPC call cancelled: ${consumerError.serviceName}.${consumerError.methodName}`,
            );
        } else if (RETRYABLE_STATUS_CODES.includes(consumerError.code)) {
            // Retryable errors are warnings
            this.logger.warn(`gRPC call failed (retryable): ${consumerError.message}`);
        } else {
            // Non-retryable errors are logged as errors
            this.logger.error(`gRPC call failed: ${consumerError.message}`, originalError);
        }
    }

    /**
     * Checks if an error indicates a retryable condition
     */
    isRetryableError(error: Error): boolean {
        const grpcError = this.extractGrpcError(error);
        return RETRYABLE_STATUS_CODES.includes(grpcError.code);
    }
}

/**
 * gRPC-specific RPC exception
 */
export class GrpcException extends RpcException {
    private readonly code: GrpcErrorCode;
    private readonly details: any;
    private readonly metadata: Record<string, string | Buffer | string[] | Buffer[]>;

    /**
     * Creates a new GrpcException
     * @param options The exception options or error message
     */
    constructor(options: GrpcExceptionOptions | string) {
        const opts = GrpcException.normalizeOptions(options);

        super(opts.message);

        this.code = opts.code;
        this.details = opts.details ?? null;
        this.metadata = GrpcException.validateMetadata(opts.metadata ?? {});

        Object.defineProperty(this, 'name', { value: 'GrpcException' });
    }

    /**
     * Normalizes constructor options
     */
    private static normalizeOptions(options: GrpcExceptionOptions | string): GrpcExceptionOptions {
        if (typeof options === 'string') {
            if (!options.trim()) {
                throw new Error('Error message cannot be empty');
            }
            return {
                code: GrpcErrorCode.UNKNOWN,
                message: options.trim(),
            };
        }

        if (!options || typeof options !== 'object') {
            throw new Error('Options must be an object or string');
        }

        if (!options.message || typeof options.message !== 'string') {
            throw new Error('Message is required and must be a string');
        }

        if (options.message.trim().length === 0) {
            throw new Error('Message cannot be empty');
        }

        if (!Object.values(GrpcErrorCode).includes(options.code)) {
            throw new Error(`Invalid gRPC error code: ${options.code}`);
        }

        return {
            code: options.code,
            message: options.message.trim(),
            details: options.details,
            metadata: options.metadata,
        };
    }

    /**
     * Validates metadata object
     */
    private static validateMetadata(
        metadata: any,
    ): Record<string, string | Buffer | string[] | Buffer[]> {
        if (!metadata) {
            return {};
        }

        if (typeof metadata !== 'object' || Array.isArray(metadata)) {
            throw new Error('Metadata must be an object');
        }

        const validatedMetadata: Record<string, string | Buffer | string[] | Buffer[]> = {};

        for (const [key, value] of Object.entries(metadata)) {
            if (!key || typeof key !== 'string') {
                throw new Error('Metadata keys must be non-empty strings');
            }

            if (value === null || value === undefined) {
                continue;
            }

            if (typeof value === 'string' || Buffer.isBuffer(value)) {
                validatedMetadata[key] = value;
            } else if (Array.isArray(value)) {
                const stringArray = value.filter(
                    (item): item is string => typeof item === 'string',
                );
                const bufferArray = value.filter((item): item is Buffer => Buffer.isBuffer(item));

                if (stringArray.length > 0) {
                    validatedMetadata[key] = stringArray;
                } else if (bufferArray.length > 0) {
                    validatedMetadata[key] = bufferArray;
                }
            }
        }

        return validatedMetadata;
    }

    /**
     * Gets the gRPC status code
     */
    public getCode(): GrpcErrorCode {
        return this.code;
    }

    /**
     * Gets the error details
     */
    public getDetails(): any {
        return this.details;
    }

    /**
     * Gets the error metadata
     */
    public getMetadata(): Record<string, string | Buffer | string[] | Buffer[]> {
        return { ...this.metadata };
    }

    /**
     * Converts the metadata to a gRPC Metadata object
     */
    public toMetadata(): Metadata {
        const metadata = new Metadata();

        try {
            Object.entries(this.metadata).forEach(([key, value]) => {
                if (value === null || value === undefined) {
                    return;
                }

                if (Array.isArray(value)) {
                    value.forEach(v => {
                        if (v !== null && v !== undefined) {
                            metadata.add(key, v);
                        }
                    });
                } else {
                    metadata.add(key, value);
                }
            });
        } catch (_error) {
            return new Metadata();
        }

        return metadata;
    }

    /**
     * Gets the error as a plain object
     */
    public getError(): any {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            metadata: this.metadata,
        };
    }

    // Static factory methods for common gRPC errors
    static ok(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.OK, message, details, metadata });
    }

    static cancelled(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.CANCELLED, message, details, metadata });
    }

    static unknown(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.UNKNOWN, message, details, metadata });
    }

    static invalidArgument(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.INVALID_ARGUMENT,
            message,
            details,
            metadata,
        });
    }

    static deadlineExceeded(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.DEADLINE_EXCEEDED,
            message,
            details,
            metadata,
        });
    }

    static notFound(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.NOT_FOUND, message, details, metadata });
    }

    static alreadyExists(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.ALREADY_EXISTS,
            message,
            details,
            metadata,
        });
    }

    static permissionDenied(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.PERMISSION_DENIED,
            message,
            details,
            metadata,
        });
    }

    static resourceExhausted(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.RESOURCE_EXHAUSTED,
            message,
            details,
            metadata,
        });
    }

    static failedPrecondition(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.FAILED_PRECONDITION,
            message,
            details,
            metadata,
        });
    }

    static aborted(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.ABORTED, message, details, metadata });
    }

    static outOfRange(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.OUT_OF_RANGE, message, details, metadata });
    }

    static unimplemented(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.UNIMPLEMENTED, message, details, metadata });
    }

    static internal(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.INTERNAL, message, details, metadata });
    }

    static unavailable(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.UNAVAILABLE, message, details, metadata });
    }

    static dataLoss(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({ code: GrpcErrorCode.DATA_LOSS, message, details, metadata });
    }

    static unauthenticated(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.UNAUTHENTICATED,
            message,
            details,
            metadata,
        });
    }
}
