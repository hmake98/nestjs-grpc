import { RpcException } from '@nestjs/microservices';
import { GrpcErrorCode } from '../constants';

export interface GrpcExceptionOptions {
    code: GrpcErrorCode;
    message: string;
    details?: any;
    metadata?: Record<string, string>;
}

/**
 * gRPC-specific RPC exception
 */
export class GrpcException extends RpcException {
    private readonly code: GrpcErrorCode;
    private readonly details: any;
    private readonly metadata: Record<string, string>;

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
    public getMetadata(): Record<string, string> {
        return this.metadata;
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
     * Factory method to create a NOT_FOUND exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
     */
    static notFound(
        message: string,
        details?: any,
        metadata?: Record<string, string>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.NOT_FOUND,
            message,
            details,
            metadata,
        });
    }

    /**
     * Factory method to create an INVALID_ARGUMENT exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
     */
    static invalidArgument(
        message: string,
        details?: any,
        metadata?: Record<string, string>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.INVALID_ARGUMENT,
            message,
            details,
            metadata,
        });
    }

    /**
     * Factory method to create an ALREADY_EXISTS exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
     */
    static alreadyExists(
        message: string,
        details?: any,
        metadata?: Record<string, string>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.ALREADY_EXISTS,
            message,
            details,
            metadata,
        });
    }

    /**
     * Factory method to create a PERMISSION_DENIED exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
     */
    static permissionDenied(
        message: string,
        details?: any,
        metadata?: Record<string, string>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.PERMISSION_DENIED,
            message,
            details,
            metadata,
        });
    }

    /**
     * Factory method to create an UNAUTHENTICATED exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
     */
    static unauthenticated(
        message: string,
        details?: any,
        metadata?: Record<string, string>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.UNAUTHENTICATED,
            message,
            details,
            metadata,
        });
    }

    /**
     * Factory method to create an INTERNAL exception
     * @param message The error message
     * @param details Optional error details
     * @param metadata Optional error metadata
     */
    static internal(
        message: string,
        details?: any,
        metadata?: Record<string, string>,
    ): GrpcException {
        return new GrpcException({
            code: GrpcErrorCode.INTERNAL,
            message,
            details,
            metadata,
        });
    }
}
