import { Metadata } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';

import { GrpcErrorCode } from '../constants';

import type { GrpcExceptionOptions } from '../interfaces';

/**
 * gRPC-specific RPC exception with enhanced metadata support and validation
 */
export class GrpcException extends RpcException {
    private readonly code: GrpcErrorCode;
    private readonly details: any;
    private readonly metadata: Record<string, string | Buffer | string[] | Buffer[]>;

    /**
     * Creates a new GrpcException with validation
     * @param options The exception options or error message
     */
    constructor(options: GrpcExceptionOptions | string) {
        const opts = GrpcException.normalizeOptions(options);

        super(opts.message);

        this.code = opts.code;
        this.details = opts.details || null;
        this.metadata = GrpcException.validateMetadata(opts.metadata || {});

        // Override name to match the class name
        Object.defineProperty(this, 'name', { value: 'GrpcException' });
    }

    /**
     * Normalizes constructor options with validation
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
                continue; // Skip null/undefined values
            }

            // Validate value types
            if (typeof value === 'string' || Buffer.isBuffer(value)) {
                validatedMetadata[key] = value;
            } else if (Array.isArray(value)) {
                // Validate array elements and separate strings from Buffers
                const stringArray = value.filter(
                    (item): item is string => typeof item === 'string',
                );
                const bufferArray = value.filter((item): item is Buffer => Buffer.isBuffer(item));

                if (stringArray.length > 0) {
                    validatedMetadata[key] = stringArray;
                } else if (bufferArray.length > 0) {
                    validatedMetadata[key] = bufferArray;
                }
            } else {
                console.warn(
                    `Skipping invalid metadata value for key '${key}': must be string, Buffer, or array of strings/Buffers`,
                );
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
        return { ...this.metadata }; // Return copy to prevent mutation
    }

    /**
     * Converts the metadata to a gRPC Metadata object with validation
     */
    public toMetadata(): Metadata {
        const metadata = new Metadata();

        try {
            Object.entries(this.metadata).forEach(([key, value]) => {
                if (value === null || value === undefined) {
                    return; // Skip null/undefined values
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
        } catch (error) {
            console.warn('Error converting metadata:', error.message);
            // Return empty metadata on error
            return new Metadata();
        }

        return metadata;
    }

    /**
     * Gets the error as a plain object suitable for serialization
     */
    public getError(): any {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            metadata: this.metadata,
        };
    }

    /**
     * Converts error to JSON with validation
     */
    public toJSON(): any {
        try {
            return {
                name: this.name,
                code: this.code,
                message: this.message,
                details: this.details,
                metadata: this.metadata,
            };
        } catch {
            return {
                name: this.name,
                code: this.code,
                message: this.message,
                details: null,
                metadata: {},
            };
        }
    }

    /**
     * Creates a NOT_FOUND exception with validation
     */
    static notFound(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.NOT_FOUND,
            message,
            details,
            metadata,
        });
    }

    /**
     * Creates an INVALID_ARGUMENT exception with validation
     */
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

    /**
     * Creates an ALREADY_EXISTS exception with validation
     */
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

    /**
     * Creates a PERMISSION_DENIED exception with validation
     */
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

    /**
     * Creates an INTERNAL exception with validation
     */
    static internal(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.INTERNAL,
            message,
            details,
            metadata,
        });
    }

    /**
     * Creates a UNAUTHENTICATED exception with validation
     */
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

    /**
     * Creates a RESOURCE_EXHAUSTED exception with validation
     */
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

    /**
     * Creates an UNAVAILABLE exception with validation
     */
    static unavailable(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.UNAVAILABLE,
            message,
            details,
            metadata,
        });
    }
}
