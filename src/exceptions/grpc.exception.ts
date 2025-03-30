import { RpcException } from '@nestjs/microservices';
import { GrpcErrorCode } from '../constants';
import { Metadata } from '@grpc/grpc-js';
import { GrpcExceptionOptions } from 'src/interfaces/gprc-exception-options.interface';

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
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
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
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
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
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
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
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
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
     * Creates an UNAUTHENTICATED exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
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
     * Creates an INTERNAL exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
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
     * Creates a FAILED_PRECONDITION exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
     */
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

    /**
     * Creates a RESOURCE_EXHAUSTED exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
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
     * Creates a DEADLINE_EXCEEDED exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
     */
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

    /**
     * Creates a CANCELLED exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
     */
    static cancelled(
        message: string,
        details?: any,
        metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.CANCELLED,
            message,
            details,
            metadata,
        });
    }
}
