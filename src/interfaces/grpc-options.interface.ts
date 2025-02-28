import { Options } from '@grpc/proto-loader';

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
