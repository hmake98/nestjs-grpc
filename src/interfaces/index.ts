import { Options } from '@grpc/proto-loader';
import { GrpcErrorCode } from '../constants';

/**
 * Options for the gRPC module
 */
export interface GrpcOptions {
    /**
     * Path to the proto file
     */
    protoPath: string;

    /**
     * Package name as defined in the proto file
     */
    package: string;

    /**
     * URL for the gRPC server (e.g., 'localhost:50051')
     */
    url?: string;

    /**
     * Whether to use secure connection (TLS)
     */
    secure?: boolean;

    /**
     * Root certificates for TLS (when secure is true)
     */
    rootCerts?: Buffer;

    /**
     * Private key for TLS (when secure is true)
     */
    privateKey?: Buffer;

    /**
     * Certificate chain for TLS (when secure is true)
     */
    certChain?: Buffer;

    /**
     * Maximum send message size in bytes
     */
    maxSendMessageSize?: number;

    /**
     * Maximum receive message size in bytes
     */
    maxReceiveMessageSize?: number;

    /**
     * Options for the proto loader
     */
    loaderOptions?: Options;
}

/**
 * Options for creating a gRPC client
 */
export interface GrpcClientOptions {
    /**
     * Service name as defined in the proto file
     */
    service: string;

    /**
     * Package name as defined in the proto file
     */
    package?: string;

    /**
     * Proto file path (optional if global options are used)
     */
    protoPath?: string;

    /**
     * URL for the gRPC server (e.g., 'localhost:50051')
     */
    url?: string;

    /**
     * Maximum number of retry attempts
     */
    maxRetries?: number;

    /**
     * Retry delay in milliseconds
     */
    retryDelay?: number;

    /**
     * Whether to use secure connection (TLS)
     */
    secure?: boolean;

    /**
     * Root certificates for TLS (when secure is true)
     */
    rootCerts?: Buffer;

    /**
     * Private key for TLS (when secure is true)
     */
    privateKey?: Buffer;

    /**
     * Certificate chain for TLS (when secure is true)
     */
    certChain?: Buffer;

    /**
     * Request timeout in milliseconds
     */
    timeout?: number;

    /**
     * Custom gRPC channel options
     * @see https://grpc.github.io/grpc/core/group__grpc__arg__keys.html
     */
    channelOptions?: Record<string, any>;
}

/**
 * Factory for creating gRPC options
 */
export interface GrpcOptionsFactory {
    createGrpcOptions(): Promise<GrpcOptions> | GrpcOptions;
}

/**
 * Async options for the gRPC module
 */
export interface GrpcModuleAsyncOptions {
    /**
     * Factory function for creating options
     */
    useFactory: (...args: any[]) => Promise<GrpcOptions> | GrpcOptions;

    /**
     * Dependencies for the factory function
     */
    inject?: any[];
}

/**
 * Interface for gRPC method options
 */
export interface GrpcMethodOptions {
    /**
     * Method name as defined in the proto file
     * If not provided, the method name will be used
     */
    methodName?: string;

    /**
     * Whether the method is a server streaming method
     */
    streaming?: boolean;
}

/**
 * Interface for gRPC service options
 */
export interface GrpcServiceOptions {
    /**
     * Service name as defined in the proto file
     */
    serviceName: string;

    /**
     * The proto package name
     */
    package?: string;
}

/**
 * Options for the GrpcException constructor
 */
export interface GrpcExceptionOptions {
    /**
     * gRPC error code
     */
    code: GrpcErrorCode;

    /**
     * Error message
     */
    message: string;

    /**
     * Additional error details (serializable object)
     */
    details?: any;

    /**
     * Metadata to be sent with the error response
     */
    metadata?: Record<string, string | Buffer | string[] | Buffer[]>;
}

/**
 * Options for the generate command
 */
export interface GenerateCommandOptions {
    proto: string;
    output: string;
    watch: boolean;
    recursive?: boolean;
    classes?: boolean;
    comments?: boolean;
    packageFilter?: string;
    verbose?: boolean;
    silent?: boolean;
    noClientInterfaces?: boolean;
}
