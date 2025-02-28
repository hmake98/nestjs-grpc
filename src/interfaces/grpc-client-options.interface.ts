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

    /**
     * Custom call credentials (for authentication)
     */
    credentials?: {
        /**
         * Type of authentication (e.g., 'jwt', 'oauth')
         */
        type: string;

        /**
         * Authentication token
         */
        token?: string;

        /**
         * Custom metadata for authentication
         */
        metadata?: Record<string, string>;
    };
}
