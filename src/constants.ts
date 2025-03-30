/**
 * Token for gRPC options injection
 */
export const GRPC_OPTIONS = 'GRPC_OPTIONS';

/**
 * Token for gRPC logger injection
 */
export const GRPC_LOGGER = 'GRPC_LOGGER';

/**
 * Token for gRPC metadata parser injection
 */
export const GRPC_METADATA_PARSER = 'GRPC_METADATA_PARSER';

/**
 * Metadata key for gRPC service
 */
export const GRPC_SERVICE_METADATA = 'GRPC_SERVICE_METADATA';

/**
 * Metadata key for gRPC method
 */
export const GRPC_METHOD_METADATA = 'GRPC_METHOD_METADATA';

/**
 * Default gRPC maximum message size (4MB)
 */
export const DEFAULT_MAX_MESSAGE_SIZE = 4 * 1024 * 1024;

/**
 * Default gRPC keepalive time (ms)
 */
export const DEFAULT_KEEPALIVE_TIME_MS = 60000;

/**
 * Default gRPC keepalive timeout (ms)
 */
export const DEFAULT_KEEPALIVE_TIMEOUT_MS = 20000;

/**
 * Default gRPC max concurrent streams
 */
export const DEFAULT_MAX_CONCURRENT_STREAMS = 100;

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
