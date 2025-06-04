import { Metadata } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';

import { GrpcErrorCode } from '../constants';

import type { GrpcExceptionOptions } from '../interfaces';

/**
 * gRPC-specific RPC exception with enhanced metadata support
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
        const opts =
            typeof options === 'string'
                ? { code: GrpcErrorCode.UNKNOWN, message: options }
                : options;

        super(opts.message);
        this.code = opts.code;
        this.details = opts.details || null;
        this.metadata = opts.metadata || {};

        // Override name to match the class name
        Object.defineProperty(this, 'name', { value: 'GrpcException' });
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
        return this.metadata;
    }

    /**
     * Converts the metadata to a gRPC Metadata object
     */
    public toMetadata(): Metadata {
        const metadata = new Metadata();

        Object.entries(this.metadata).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => metadata.add(key, v));
            } else {
                metadata.add(key, value);
            }
        });

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
     * Creates a NOT_FOUND exception
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
     * Creates an INVALID_ARGUMENT exception
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
     * Creates an ALREADY_EXISTS exception
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
     * Creates a PERMISSION_DENIED exception
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
     * Creates an INTERNAL exception
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
}
