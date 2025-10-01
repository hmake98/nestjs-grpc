/**
 * Dependency injection token for gRPC configuration options.
 * Used to inject GrpcOptions throughout the application.
 *
 * @example
 * ```typescript
 * constructor(@Inject(GRPC_OPTIONS) private options: GrpcOptions) {}
 * ```
 */
export const GRPC_OPTIONS = 'GRPC_OPTIONS';

/**
 * Metadata key for storing gRPC controller configuration.
 * Applied by the @GrpcController decorator to mark classes as gRPC service handlers.
 *
 * @example
 * ```typescript
 * @GrpcController('AuthService')
 * export class AuthController {
 *   // Controller metadata stored under this key
 * }
 * ```
 */
export const GRPC_CONTROLLER_METADATA = 'GRPC_CONTROLLER_METADATA';

/**
 * Metadata key for storing gRPC method configuration.
 * Applied by @GrpcMethod and @GrpcStream decorators to mark handler methods.
 *
 * @example
 * ```typescript
 * @GrpcMethod('login')
 * async login() {
 *   // Method metadata stored under this key
 * }
 * ```
 */
export const GRPC_METHOD_METADATA = 'GRPC_METHOD_METADATA';

/**
 * Metadata key for storing gRPC service client configuration.
 * Applied by the @GrpcService decorator to mark client service classes.
 *
 * @example
 * ```typescript
 * @GrpcService('AuthService')
 * export class AuthServiceClient {
 *   // Service metadata stored under this key
 * }
 * ```
 */
export const GRPC_SERVICE_METADATA = 'GRPC_SERVICE_METADATA';

/**
 * Prefix for gRPC client dependency injection tokens.
 * Used by @InjectGrpcClient to create unique tokens for each service.
 *
 * @example
 * ```typescript
 * // Creates token: GRPC_CLIENT_AuthService
 * constructor(@InjectGrpcClient('AuthService') private client: any) {}
 * ```
 */
export const GRPC_CLIENT_TOKEN_PREFIX = 'GRPC_CLIENT_';

/**
 * Default maximum message size for gRPC communications (4MB).
 * Applied to both send and receive operations unless overridden.
 *
 * @example
 * ```typescript
 * const options: GrpcOptions = {
 *   maxSendMessageSize: DEFAULT_MAX_MESSAGE_SIZE,
 *   maxReceiveMessageSize: DEFAULT_MAX_MESSAGE_SIZE * 2 // Allow larger responses
 * };
 * ```
 */
export const DEFAULT_MAX_MESSAGE_SIZE = 4 * 1024 * 1024;

/**
 * Default timeout for gRPC method calls (30 seconds).
 * Can be overridden per-method or per-client.
 *
 * @example
 * ```typescript
 * // Override timeout for specific call
 * const response = await client.call('AuthService', 'login', request, {
 *   timeout: 5000 // 5 seconds instead of default
 * });
 * ```
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Default number of retry attempts for failed gRPC calls.
 * Applied automatically to unary calls when they fail with retryable errors.
 *
 * @example
 * ```typescript
 * // Override retry attempts
 * const response = await client.call('AuthService', 'login', request, {
 *   maxRetries: 5 // More retries for critical operations
 * });
 * ```
 */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/**
 * Default delay between retry attempts (1 second).
 * Used in exponential backoff retry logic.
 *
 * @example
 * ```typescript
 * // Override retry delay
 * const response = await client.call('AuthService', 'login', request, {
 *   retryDelay: 500 // Faster retries
 * });
 * ```
 */
export const DEFAULT_RETRY_DELAY = 1000;

/**
 * Validation limits for gRPC configuration parameters.
 * These constants define the acceptable ranges for various settings
 * to ensure reasonable behavior and prevent misconfigurations.
 *
 * @example
 * ```typescript
 * // Validate user-provided timeout
 * if (timeout > VALIDATION_LIMITS.MAX_TIMEOUT) {
 *   throw new Error(`Timeout cannot exceed ${VALIDATION_LIMITS.MAX_TIMEOUT}ms`);
 * }
 * ```
 */
export const VALIDATION_LIMITS = {
    /** Maximum allowed message size (100MB) */
    MAX_MESSAGE_SIZE: 100 * 1024 * 1024,
    /** Minimum allowed message size (1KB) */
    MIN_MESSAGE_SIZE: 1024,
    /** Maximum allowed timeout (5 minutes) */
    MAX_TIMEOUT: 5 * 60 * 1000,
    /** Minimum allowed timeout (1 second) */
    MIN_TIMEOUT: 1000,
    /** Maximum allowed retry attempts */
    MAX_RETRIES: 10,
    /** Minimum allowed retry attempts */
    MIN_RETRIES: 0,
    /** Maximum allowed retry delay (10 seconds) */
    MAX_RETRY_DELAY: 10000,
    /** Minimum allowed retry delay (100ms) */
    MIN_RETRY_DELAY: 100,
} as const;

/**
 * Standard gRPC status codes as defined in the gRPC specification.
 * These codes provide semantic meaning for different types of errors
 * and enable proper error handling across gRPC services.
 *
 * @see https://grpc.github.io/grpc/core/md_doc_statuscodes.html
 *
 * @example
 * ```typescript
 * // Throw a specific gRPC error
 * throw new GrpcException({
 *   code: GrpcErrorCode.NOT_FOUND,
 *   message: 'User not found'
 * });
 *
 * // Handle errors by code
 * if (error.code === GrpcErrorCode.UNAUTHENTICATED) {
 *   // Redirect to login
 * }
 * ```
 */
export enum GrpcErrorCode {
    /** Request completed successfully */
    OK = 0,
    /** Operation was cancelled (typically by the caller) */
    CANCELLED = 1,
    /** Unknown error occurred */
    UNKNOWN = 2,
    /** Client specified an invalid argument */
    INVALID_ARGUMENT = 3,
    /** Deadline expired before operation could complete */
    DEADLINE_EXCEEDED = 4,
    /** Requested entity was not found */
    NOT_FOUND = 5,
    /** Entity already exists */
    ALREADY_EXISTS = 6,
    /** Caller does not have permission to execute the operation */
    PERMISSION_DENIED = 7,
    /** Resource has been exhausted (e.g., quota exceeded) */
    RESOURCE_EXHAUSTED = 8,
    /** Operation was rejected because system is not in required state */
    FAILED_PRECONDITION = 9,
    /** Operation was aborted (typically due to concurrency issue) */
    ABORTED = 10,
    /** Operation was attempted past the valid range */
    OUT_OF_RANGE = 11,
    /** Operation is not implemented or supported */
    UNIMPLEMENTED = 12,
    /** Internal server error */
    INTERNAL = 13,
    /** Service is currently unavailable */
    UNAVAILABLE = 14,
    /** Unrecoverable data loss or corruption */
    DATA_LOSS = 15,
    /** Request does not have valid authentication credentials */
    UNAUTHENTICATED = 16,
}

/**
 * Status codes that are considered retryable.
 * These errors typically indicate temporary failures that may succeed on retry.
 *
 * @example
 * ```typescript
 * if (RETRYABLE_STATUS_CODES.includes(error.code)) {
 *   // Retry the operation
 * }
 * ```
 */
export const RETRYABLE_STATUS_CODES = [
    GrpcErrorCode.UNAVAILABLE,
    GrpcErrorCode.DEADLINE_EXCEEDED,
    GrpcErrorCode.RESOURCE_EXHAUSTED,
    GrpcErrorCode.ABORTED,
    GrpcErrorCode.INTERNAL,
];

/**
 * Type mapping from protobuf types to TypeScript types.
 * Used for automatic type generation from proto files.
 *
 * @example
 * ```typescript
 * const tsType = TYPE_MAPPING['int32']; // returns 'number'
 * const tsType = TYPE_MAPPING['string']; // returns 'string'
 * ```
 */
export const TYPE_MAPPING: Record<string, string> = {
    double: 'number',
    float: 'number',
    int32: 'number',
    int64: 'string',
    uint32: 'number',
    uint64: 'string',
    sint32: 'number',
    sint64: 'string',
    fixed32: 'number',
    fixed64: 'string',
    sfixed32: 'number',
    sfixed64: 'string',
    bool: 'boolean',
    string: 'string',
    bytes: 'Uint8Array',
};
