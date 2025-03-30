import { GrpcErrorCode } from 'src/constants';

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
