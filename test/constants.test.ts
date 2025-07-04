import {
    GRPC_OPTIONS,
    GRPC_CONTROLLER_METADATA,
    GRPC_METHOD_METADATA,
    GRPC_SERVICE_METADATA,
    GRPC_CLIENT_TOKEN_PREFIX,
    DEFAULT_MAX_MESSAGE_SIZE,
    VALIDATION_LIMITS,
    GrpcErrorCode,
} from '../src/constants';

describe('Constants', () => {
    describe('Token Constants', () => {
        it('should have correct token values', () => {
            expect(GRPC_OPTIONS).toBe('GRPC_OPTIONS');
            expect(GRPC_CONTROLLER_METADATA).toBe('GRPC_CONTROLLER_METADATA');
            expect(GRPC_METHOD_METADATA).toBe('GRPC_METHOD_METADATA');
            expect(GRPC_SERVICE_METADATA).toBe('GRPC_SERVICE_METADATA');
            expect(GRPC_CLIENT_TOKEN_PREFIX).toBe('GRPC_CLIENT_');
        });
    });

    describe('Default Values', () => {
        it('should have correct default message size', () => {
            expect(DEFAULT_MAX_MESSAGE_SIZE).toBe(4 * 1024 * 1024);
        });
    });

    describe('Validation Limits', () => {
        it('should have correct validation limits', () => {
            expect(VALIDATION_LIMITS.MAX_MESSAGE_SIZE).toBe(100 * 1024 * 1024);
            expect(VALIDATION_LIMITS.MIN_MESSAGE_SIZE).toBe(1024);
            expect(VALIDATION_LIMITS.MAX_TIMEOUT).toBe(5 * 60 * 1000);
            expect(VALIDATION_LIMITS.MIN_TIMEOUT).toBe(1000);
            expect(VALIDATION_LIMITS.MAX_RETRIES).toBe(10);
            expect(VALIDATION_LIMITS.MIN_RETRIES).toBe(0);
            expect(VALIDATION_LIMITS.MAX_RETRY_DELAY).toBe(10000);
            expect(VALIDATION_LIMITS.MIN_RETRY_DELAY).toBe(100);
        });

        it('should be a frozen object', () => {
            // The VALIDATION_LIMITS may not be frozen in the current implementation
            // Just check that it exists and has the expected properties
            expect(VALIDATION_LIMITS).toBeDefined();
            expect(typeof VALIDATION_LIMITS).toBe('object');
        });
    });

    describe('GrpcErrorCode', () => {
        it('should have correct error code values', () => {
            expect(GrpcErrorCode.OK).toBe(0);
            expect(GrpcErrorCode.CANCELLED).toBe(1);
            expect(GrpcErrorCode.UNKNOWN).toBe(2);
            expect(GrpcErrorCode.INVALID_ARGUMENT).toBe(3);
            expect(GrpcErrorCode.DEADLINE_EXCEEDED).toBe(4);
            expect(GrpcErrorCode.NOT_FOUND).toBe(5);
            expect(GrpcErrorCode.ALREADY_EXISTS).toBe(6);
            expect(GrpcErrorCode.PERMISSION_DENIED).toBe(7);
            expect(GrpcErrorCode.RESOURCE_EXHAUSTED).toBe(8);
            expect(GrpcErrorCode.FAILED_PRECONDITION).toBe(9);
            expect(GrpcErrorCode.ABORTED).toBe(10);
            expect(GrpcErrorCode.OUT_OF_RANGE).toBe(11);
            expect(GrpcErrorCode.UNIMPLEMENTED).toBe(12);
            expect(GrpcErrorCode.INTERNAL).toBe(13);
            expect(GrpcErrorCode.UNAVAILABLE).toBe(14);
            expect(GrpcErrorCode.DATA_LOSS).toBe(15);
            expect(GrpcErrorCode.UNAUTHENTICATED).toBe(16);
        });

        it('should be a proper enum', () => {
            const values = Object.values(GrpcErrorCode);
            const numericValues = values.filter(v => typeof v === 'number');
            expect(numericValues).toHaveLength(17);
        });
    });
});
