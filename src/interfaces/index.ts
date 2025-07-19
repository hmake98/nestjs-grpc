import type { GrpcErrorCode } from '../constants';
import type { Options } from '@grpc/proto-loader';
import type { DynamicModule, ModuleMetadata, Provider, Type, LogLevel } from '@nestjs/common';

/**
 * Logger configuration options
 */
export interface GrpcLoggerOptions {
    /**
     * Enable/disable logging
     * @default true
     */
    enabled?: boolean;

    /**
     * Log level (debug, verbose, log, warn, error)
     * @default 'log'
     */
    level?: LogLevel;

    /**
     * Custom context for logger
     * @default 'GrpcModule'
     */
    context?: string;

    /**
     * Enable error logging
     * @default true
     */
    logErrors?: boolean;

    /**
     * Enable performance logging
     * @default false
     */
    logPerformance?: boolean;

    /**
     * Enable detailed request/response logging
     * @default false
     */
    logDetails?: boolean;
}

/**
 * Logging options for gRPC module
 */
export interface GrpcLoggingOptions {
    /**
     * Enable/disable logging
     * @default true
     */
    enabled?: boolean;

    /**
     * Log level (debug, verbose, log, warn, error)
     * @default 'log'
     */
    level?: LogLevel;

    /**
     * Custom context for logger
     * @default 'GrpcModule'
     */
    context?: string;

    /**
     * Enable error logging
     * @default true
     */
    logErrors?: boolean;

    /**
     * Enable performance logging
     * @default false
     */
    logPerformance?: boolean;

    /**
     * Enable detailed request/response logging
     * @default false
     */
    logDetails?: boolean;
}

/**
 * Configuration options for the gRPC module.
 * These options control how proto files are loaded, connections are established,
 * and how the gRPC services behave.
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

    /**
     * Logging configuration
     */
    logging?: GrpcLoggingOptions;
}

/**
 * Configuration options for creating individual gRPC clients.
 * These options allow fine-tuning of client behavior per service.
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
export interface GrpcModuleAsyncOptions extends Pick<ModuleMetadata, 'imports' | 'providers'> {
    /**
     * Factory function to create gRPC options
     */
    useFactory?: (...args: any[]) => Promise<GrpcOptions> | GrpcOptions;

    /**
     * Class that implements GrpcOptionsFactory
     */
    useClass?: Type<GrpcOptionsFactory>;

    /**
     * Existing provider that implements GrpcOptionsFactory
     */
    useExisting?: Type<GrpcOptionsFactory>;

    /**
     * Dependencies to inject into the factory function
     */
    inject?: any[];
}

/**
 * Options for gRPC feature modules
 */
export interface GrpcFeatureOptions {
    /**
     * gRPC service clients to register (classes decorated with @GrpcService)
     */
    services?: Type<any>[];

    /**
     * Additional providers that the controllers/services depend on
     */
    providers?: Provider[];

    /**
     * Modules to import that provide dependencies for controllers/services
     */
    imports?: Array<Type<any> | DynamicModule>;

    /**
     * Additional exports from this feature module
     */
    exports?: Array<Type<any> | string | symbol>;

    /**
     * External gRPC services to register for client injection
     * This allows you to register external services that this module will call
     */
    serviceRegistrations?: GrpcServiceRegistrationConfig[];
}

/**
 * Configuration for the local gRPC service in a feature module
 */
export interface GrpcLocalServiceConfig {
    /**
     * Path to the proto file for this service
     */
    protoPath: string;

    /**
     * Package name as defined in the proto file
     */
    package: string;

    /**
     * Service URL/endpoint for this local service
     */
    url?: string;

    /**
     * Logging configuration for this service
     */
    logging?: GrpcLoggingOptions;

    /**
     * Additional local service options
     */
    options?: {
        secure?: boolean;
        rootCerts?: Buffer;
        privateKey?: Buffer;
        certChain?: Buffer;
        maxSendMessageSize?: number;
        maxReceiveMessageSize?: number;
    };
}

/**
 * Configuration for registering external gRPC services in feature modules
 */
export interface GrpcServiceRegistrationConfig {
    /**
     * Service name as defined in the proto file
     */
    serviceName: string;

    /**
     * Package name as defined in the proto file
     */
    package: string;

    /**
     * Path to the proto file
     */
    protoPath: string;

    /**
     * Service URL/endpoint
     */
    url: string;

    /**
     * Service-specific client options
     */
    options?: {
        secure?: boolean;
        rootCerts?: Buffer;
        privateKey?: Buffer;
        certChain?: Buffer;
        maxSendMessageSize?: number;
        maxReceiveMessageSize?: number;
        timeout?: number;
        maxRetries?: number;
        retryDelay?: number;
    };
}

/**
 * Options for gRPC method decorator
 */
export interface GrpcMethodOptions {
    /**
     * Method name as defined in the proto file
     * If not provided, uses the decorator target method name
     */
    methodName?: string;

    /**
     * Whether the method is a streaming method
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
 * Options for gRPC controller decorator
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
 * Options for gRPC service decorator
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
 * Options for gRPC exception
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
     * Additional error details (must be JSON serializable)
     */
    details?: any;

    /**
     * Metadata to be sent with the error response
     */
    metadata?: Record<string, string | Buffer | string[] | Buffer[]>;
}

/**
 * Options for CLI generate command
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
 * Metadata for gRPC controller
 */
export interface ControllerMetadata {
    serviceName: string;
    package?: string;
    url?: string;
    methods: Map<string, GrpcMethodOptions>;
}

/**
 * Metadata for gRPC service client
 */
export interface ServiceClientMetadata {
    serviceName: string;
    package?: string;
    url?: string;
    clientOptions?: Partial<GrpcClientOptions>;
}

/**
 * Options for gRPC exception filter
 */
export interface GrpcExceptionFilterOptions {
    /**
     * Enable/disable logging
     * @default true
     */
    enableLogging?: boolean;

    /**
     * Maximum message length before truncation
     * @default 1000
     */
    maxMessageLength?: number;

    /**
     * Custom fallback error message
     * @default 'Internal server error occurred'
     */
    fallbackMessage?: string;

    /**
     * Custom fallback error code
     * @default GrpcErrorCode.INTERNAL
     */
    fallbackCode?: GrpcErrorCode;
}

/**
 * gRPC error response
 */
export interface GrpcErrorResponse {
    /**
     * gRPC status code
     */
    code: number;

    /**
     * Error message
     */
    message: string;

    /**
     * Additional error details
     */
    details?: any;

    /**
     * gRPC metadata
     */
    metadata?: any;
}

/**
 * gRPC error details
 */
export interface GrpcErrorDetails {
    /**
     * Error value if details cannot be serialized
     */
    value?: string;

    /**
     * Error message if details cannot be serialized
     */
    error?: string;

    /**
     * Original HTTP status code if available
     */
    httpStatus?: number;

    /**
     * Additional error properties
     */
    [key: string]: any;
}

/**
 * HTTP to gRPC status mapping
 */
export interface HttpToGrpcStatusMapping {
    /**
     * HTTP status code
     */
    httpStatus: number;

    /**
     * Corresponding gRPC status code
     */
    grpcStatus: number;

    /**
     * Optional description of the mapping
     */
    description?: string;
}

/**
 * Async options for gRPC feature modules
 */
export interface GrpcFeatureAsyncOptions extends Pick<ModuleMetadata, 'imports' | 'providers'> {
    /**
     * Factory function to create gRPC feature options
     */
    useFactory?: (...args: any[]) => Promise<GrpcFeatureOptions> | GrpcFeatureOptions;

    /**
     * Class that implements a factory for GrpcFeatureOptions
     */
    useClass?: Type<any>;

    /**
     * Existing provider that implements a factory for GrpcFeatureOptions
     */
    useExisting?: Type<any>;

    /**
     * Dependencies to inject into the factory function
     */
    inject?: any[];
}
