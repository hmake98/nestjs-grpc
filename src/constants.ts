/**
 * Token for gRPC options injection
 */
export const GRPC_OPTIONS = 'GRPC_OPTIONS';

/**
 * Metadata key for gRPC controller
 */
export const GRPC_CONTROLLER_METADATA = 'GRPC_CONTROLLER_METADATA';

/**
 * Metadata key for gRPC method
 */
export const GRPC_METHOD_METADATA = 'GRPC_METHOD_METADATA';

/**
 * Metadata key for gRPC service client
 */
export const GRPC_SERVICE_METADATA = 'GRPC_SERVICE_METADATA';

/**
 * Token for gRPC client instances
 */
export const GRPC_CLIENT_TOKEN_PREFIX = 'GRPC_CLIENT_';

/**
 * Default gRPC maximum message size
 */
export const DEFAULT_MAX_MESSAGE_SIZE = 4 * 1024 * 1024;

/**
 * Default gRPC minimum message size
 */
export const VALIDATION_LIMITS = {
    MAX_MESSAGE_SIZE: 100 * 1024 * 1024, // 100MB
    MIN_MESSAGE_SIZE: 1024, // 1KB
    MAX_TIMEOUT: 5 * 60 * 1000, // 5 minutes
    MIN_TIMEOUT: 1000, // 1 second
    MAX_RETRIES: 10,
    MIN_RETRIES: 0,
    MAX_RETRY_DELAY: 10000, // 10 seconds
    MIN_RETRY_DELAY: 100, // 100ms
} as const;

/**
 * Error codes for gRPC
 */
export enum GrpcErrorCode {
    OK = 0,
    CANCELLED = 1,
    UNKNOWN = 2,
    INVALID_ARGUMENT = 3,
    DEADLINE_EXCEEDED = 4,
    NOT_FOUND = 5,
    ALREADY_EXISTS = 6,
    PERMISSION_DENIED = 7,
    RESOURCE_EXHAUSTED = 8,
    FAILED_PRECONDITION = 9,
    ABORTED = 10,
    OUT_OF_RANGE = 11,
    UNIMPLEMENTED = 12,
    INTERNAL = 13,
    UNAVAILABLE = 14,
    DATA_LOSS = 15,
    UNAUTHENTICATED = 16,
}
