import type { GrpcErrorCode } from '../constants';
import type { Options } from '@grpc/proto-loader';

/**
 * Options for the gRPC module
 */
export interface GrpcOptions {
    /**
     * Path to the proto file, directory, or glob pattern
     * @example './protos/service.proto'
     */
    protoPath: string;

    /**
     * Package name as defined in the proto file
     * @example 'com.example.service'
     */
    package: string;

    /**
     * URL for the gRPC server
     * @example 'localhost:50051'
     * @default 'localhost:50051'
     */
    url?: string;

    /**
     * Whether to use secure connection (TLS)
     * @default false
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
     * @default 4194304 (4MB)
     */
    maxSendMessageSize?: number;

    /**
     * Maximum receive message size in bytes
     * @default 4194304 (4MB)
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
     * If not provided, uses global package
     */
    package?: string;

    /**
     * Proto file path (optional if global options are used)
     */
    protoPath?: string;

    /**
     * URL for the gRPC server
     * If not provided, uses global URL
     * @example 'localhost:50051'
     */
    url?: string;

    /**
     * Maximum number of retry attempts
     * @min 0
     * @max 10
     * @default 3
     */
    maxRetries?: number;

    /**
     * Retry delay in milliseconds
     * @min 100
     * @max 10000
     * @default 1000
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
     * @min 1000
     * @max 300000
     * @default 30000
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
    /**
     * Creates gRPC options
     */
    createGrpcOptions(): Promise<GrpcOptions> | GrpcOptions;
}

/**
 * Async options for the gRPC module
 */
export interface GrpcModuleAsyncOptions {
    /**
     * Factory function for creating options
     */
    useFactory?: (...args: any[]) => Promise<GrpcOptions> | GrpcOptions;

    /**
     * Dependencies for the factory function
     */
    inject?: any[];

    /**
     * Use existing provider
     */
    useExisting?: any;

    /**
     * Use class provider
     */
    useClass?: any;
}

/**
 * Interface for gRPC method options
 */
export interface GrpcMethodOptions {
    /**
     * Method name as defined in the proto file
     * If not provided, uses the decorator target method name
     */
    methodName?: string;

    /**
     * Whether the method is a server streaming method
     * @default false
     */
    streaming?: boolean;

    /**
     * Custom timeout for this method in milliseconds
     * Overrides the global timeout
     */
    timeout?: number;
}

/**
 * Interface for gRPC controller options
 */
export interface GrpcControllerOptions {
    /**
     * Service name as defined in the proto file
     */
    serviceName: string;

    /**
     * The proto package name
     * If not provided, uses global package
     */
    package?: string;

    /**
     * Custom URL for this service
     * If not provided, uses global URL
     */
    url?: string;
}

/**
 * Interface for gRPC service client options
 */
export interface GrpcServiceOptions {
    /**
     * Service name as defined in the proto file
     */
    serviceName: string;

    /**
     * The proto package name
     * If not provided, uses global package
     */
    package?: string;

    /**
     * Custom URL for this service
     * If not provided, uses global URL
     */
    url?: string;

    /**
     * Custom client options
     */
    clientOptions?: Partial<GrpcClientOptions>;
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
     * Error message (will be trimmed)
     */
    message: string;

    /**
     * Additional error details (must be JSON serializable)
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
    /**
     * Path to proto file, directory, or glob pattern
     */
    proto: string;

    /**
     * Output directory for generated files
     */
    output: string;

    /**
     * Enable watch mode for file changes
     * @default false
     */
    watch: boolean;

    /**
     * Recursively search directories for .proto files
     * @default true
     */
    recursive?: boolean;

    /**
     * Generate classes instead of interfaces
     * @default false
     */
    classes?: boolean;

    /**
     * Include comments in generated files
     * @default true
     */
    comments?: boolean;

    /**
     * Filter by package name
     */
    packageFilter?: string;

    /**
     * Enable verbose logging
     * @default false
     */
    verbose?: boolean;

    /**
     * Disable all logging except errors
     * @default false
     */
    silent?: boolean;

    /**
     * Do not generate client interfaces
     * @default false
     */
    noClientInterfaces?: boolean;
}

/**
 * Controller metadata interface
 */
export interface ControllerMetadata {
    serviceName: string;
    package?: string;
    url?: string;
    methods: Map<string, GrpcMethodOptions>;
}

/**
 * Service client metadata interface
 */
export interface ServiceClientMetadata {
    serviceName: string;
    package?: string;
    url?: string;
    clientOptions?: Partial<GrpcClientOptions>;
}
