import { Metadata } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';

import { GrpcErrorCode } from '../constants';

import type { GrpcExceptionOptions } from '../interfaces';

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
