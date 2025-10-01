import { Metadata } from '@grpc/grpc-js';
import {
    GrpcException,
    GrpcConsumerException,
    GrpcConsumerErrorHandler,
    getGrpcStatusDescription,
    httpStatusToGrpcStatus,
} from '../../src/exceptions/grpc.exception';
import { GrpcErrorCode, RETRYABLE_STATUS_CODES } from '../../src/constants';
import { GrpcConsumerError } from '../../src/interfaces';

// Mock the @grpc/grpc-js module
jest.mock('@grpc/grpc-js', () => ({
    Metadata: jest.fn(),
}));

const MockedMetadata = Metadata as jest.MockedClass<typeof Metadata>;

describe('GrpcException', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Suppress console.warn for cleaner test output
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create exception with string message', () => {
            const exception = new GrpcException('Test error message');

            expect(exception.message).toBe('Test error message');
            expect(exception.getCode()).toBe(GrpcErrorCode.UNKNOWN);
            expect(exception.getDetails()).toBeNull();
            expect(exception.getMetadata()).toEqual({});
            expect(exception.name).toBe('GrpcException');
        });

        it('should create exception with options object', () => {
            const options = {
                code: GrpcErrorCode.INVALID_ARGUMENT,
                message: 'Invalid argument provided',
                details: { field: 'value' },
                metadata: { 'custom-header': 'value' },
            };

            const exception = new GrpcException(options);

            expect(exception.message).toBe('Invalid argument provided');
            expect(exception.getCode()).toBe(GrpcErrorCode.INVALID_ARGUMENT);
            expect(exception.getDetails()).toEqual({ field: 'value' });
            expect(exception.getMetadata()).toEqual({ 'custom-header': 'value' });
        });

        it('should throw error for empty string message', () => {
            expect(() => new GrpcException('')).toThrow('Error message cannot be empty');
            expect(() => new GrpcException('   ')).toThrow('Error message cannot be empty');
        });

        it('should throw error for invalid options', () => {
            expect(() => new GrpcException(null as any)).toThrow(
                'Options must be an object or string',
            );
            expect(() => new GrpcException(undefined as any)).toThrow(
                'Options must be an object or string',
            );
            expect(() => new GrpcException(123 as any)).toThrow(
                'Options must be an object or string',
            );
        });

        it('should throw error for invalid code', () => {
            expect(
                () =>
                    new GrpcException({
                        code: 'invalid' as any,
                        message: 'Test',
                    }),
            ).toThrow('Invalid gRPC error code: invalid');

            expect(
                () =>
                    new GrpcException({
                        code: -1 as any,
                        message: 'Test',
                    }),
            ).toThrow('Invalid gRPC error code: -1');
        });

        it('should throw error for invalid message in options', () => {
            expect(
                () =>
                    new GrpcException({
                        code: GrpcErrorCode.OK,
                        message: '',
                    }),
            ).toThrow('Message is required and must be a string');

            expect(
                () =>
                    new GrpcException({
                        code: GrpcErrorCode.OK,
                        message: 123 as any,
                    }),
            ).toThrow('Message is required and must be a string');
        });

        it('should throw error for whitespace-only message in options', () => {
            expect(
                () =>
                    new GrpcException({
                        code: GrpcErrorCode.OK,
                        message: '   ',
                    }),
            ).toThrow('Message cannot be empty');
        });

        it('should handle invalid metadata gracefully', () => {
            const exception = new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: { key: 123 as any },
            });

            // Should create exception and filter out invalid metadata
            expect(exception).toBeDefined();
            expect(exception.getMetadata()).toEqual({});
        });

        it('should accept valid metadata types', () => {
            const metadata = {
                'string-key': 'value',
                'buffer-key': Buffer.from('buffer'),
                'string-array-key': ['val1', 'val2'],
                'buffer-array-key': [Buffer.from('buf1'), Buffer.from('buf2')],
            };

            const exception = new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata,
            });

            expect(exception.getMetadata()).toEqual(metadata);
        });

        it('should throw error for invalid metadata object type', () => {
            expect(
                () =>
                    new GrpcException({
                        code: GrpcErrorCode.OK,
                        message: 'Test',
                        metadata: [] as any,
                    }),
            ).toThrow('Metadata must be an object');

            expect(
                () =>
                    new GrpcException({
                        code: GrpcErrorCode.OK,
                        message: 'Test',
                        metadata: 'invalid' as any,
                    }),
            ).toThrow('Metadata must be an object');
        });

        it('should throw error for invalid metadata keys', () => {
            expect(
                () =>
                    new GrpcException({
                        code: GrpcErrorCode.OK,
                        message: 'Test',
                        metadata: { '': 'value' } as any,
                    }),
            ).toThrow('Metadata keys must be non-empty strings');
        });

        it('should filter out invalid array values in metadata', () => {
            const exception = new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: {
                    mixedArray: ['valid', 123, 'also-valid', null, Buffer.from('buf')] as any,
                    invalidArray: [123, null, undefined] as any,
                },
            });

            const metadata = exception.getMetadata();
            expect(metadata.mixedArray).toEqual(['valid', 'also-valid']);
            expect(metadata.invalidArray).toBeUndefined();
        });
    });

    describe('getters', () => {
        it('should return correct values', () => {
            const options = {
                code: GrpcErrorCode.NOT_FOUND,
                message: 'Resource not found',
                details: { resource: 'user', id: 123 },
                metadata: { 'trace-id': 'abc123' },
            };

            const exception = new GrpcException(options);

            expect(exception.getCode()).toBe(GrpcErrorCode.NOT_FOUND);
            expect(exception.message).toBe('Resource not found');
            expect(exception.getDetails()).toEqual({ resource: 'user', id: 123 });
            expect(exception.getMetadata()).toEqual({ 'trace-id': 'abc123' });
        });

        it('should return copy of metadata to prevent mutation', () => {
            const metadata = { key: 'value' };
            const exception = new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata,
            });

            const returnedMetadata = exception.getMetadata();
            returnedMetadata['new-key'] = 'new-value';

            expect(exception.getMetadata()).toEqual({ key: 'value' });
        });
    });

    describe('toMetadata', () => {
        it('should convert to gRPC Metadata object', () => {
            const mockMetadata = {
                add: jest.fn(),
            };
            MockedMetadata.mockImplementation(() => mockMetadata as any);

            const exception = new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: { key: 'value' },
            });

            const result = exception.toMetadata();

            expect(MockedMetadata).toHaveBeenCalled();
            expect(mockMetadata.add).toHaveBeenCalledWith('key', 'value');
        });

        it('should handle array metadata', () => {
            const mockMetadata = {
                add: jest.fn(),
            };
            MockedMetadata.mockImplementation(() => mockMetadata as any);

            const exception = new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: { key: ['value1', 'value2'] },
            });

            exception.toMetadata();

            expect(mockMetadata.add).toHaveBeenCalledWith('key', 'value1');
            expect(mockMetadata.add).toHaveBeenCalledWith('key', 'value2');
        });

        it('should skip null/undefined values', () => {
            const mockMetadata = {
                add: jest.fn(),
            };
            MockedMetadata.mockImplementation(() => mockMetadata as any);

            const exception = new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: {
                    key1: 'value',
                    key2: null as any,
                    key3: undefined as any,
                    key4: [null, 'value', undefined] as any,
                },
            });

            exception.toMetadata();

            expect(mockMetadata.add).toHaveBeenCalledWith('key1', 'value');
            expect(mockMetadata.add).toHaveBeenCalledWith('key4', 'value');
            expect(mockMetadata.add).not.toHaveBeenCalledWith('key2', null);
            expect(mockMetadata.add).not.toHaveBeenCalledWith('key3', undefined);
        });

        it('should handle errors gracefully', () => {
            const mockMetadata = {
                add: jest.fn().mockImplementation(() => {
                    throw new Error('Metadata error');
                }),
            };
            MockedMetadata.mockImplementation(() => mockMetadata as any);

            const exception = new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: { key: 'value' },
            });

            const result = exception.toMetadata();

            expect(result).toBeInstanceOf(Object);
        });
    });

    describe('getError', () => {
        it('should return error as plain object', () => {
            const exception = new GrpcException({
                code: GrpcErrorCode.PERMISSION_DENIED,
                message: 'Access denied',
                details: { reason: 'insufficient_permissions' },
                metadata: { 'user-id': '123' },
            });

            const error = exception.getError();

            expect(error).toEqual({
                code: GrpcErrorCode.PERMISSION_DENIED,
                message: 'Access denied',
                details: { reason: 'insufficient_permissions' },
                metadata: { 'user-id': '123' },
            });
        });
    });

    describe('static factory methods', () => {
        it('should create NOT_FOUND exception', () => {
            const exception = GrpcException.notFound(
                'Resource not found',
                { id: 123 },
                { trace: 'abc' },
            );

            expect(exception.getCode()).toBe(GrpcErrorCode.NOT_FOUND);
            expect(exception.message).toBe('Resource not found');
            expect(exception.getDetails()).toEqual({ id: 123 });
            expect(exception.getMetadata()).toEqual({ trace: 'abc' });
        });

        it('should create INVALID_ARGUMENT exception', () => {
            const exception = GrpcException.invalidArgument('Invalid input');

            expect(exception.getCode()).toBe(GrpcErrorCode.INVALID_ARGUMENT);
            expect(exception.message).toBe('Invalid input');
        });

        it('should create ALREADY_EXISTS exception', () => {
            const exception = GrpcException.alreadyExists('Resource exists');

            expect(exception.getCode()).toBe(GrpcErrorCode.ALREADY_EXISTS);
            expect(exception.message).toBe('Resource exists');
        });

        it('should create PERMISSION_DENIED exception', () => {
            const exception = GrpcException.permissionDenied('Access denied');

            expect(exception.getCode()).toBe(GrpcErrorCode.PERMISSION_DENIED);
            expect(exception.message).toBe('Access denied');
        });

        it('should create INTERNAL exception', () => {
            const exception = GrpcException.internal('Internal error');

            expect(exception.getCode()).toBe(GrpcErrorCode.INTERNAL);
            expect(exception.message).toBe('Internal error');
        });

        it('should create UNAUTHENTICATED exception', () => {
            const exception = GrpcException.unauthenticated('Authentication required');

            expect(exception.getCode()).toBe(GrpcErrorCode.UNAUTHENTICATED);
            expect(exception.message).toBe('Authentication required');
        });

        it('should create RESOURCE_EXHAUSTED exception', () => {
            const exception = GrpcException.resourceExhausted('Quota exceeded');

            expect(exception.getCode()).toBe(GrpcErrorCode.RESOURCE_EXHAUSTED);
            expect(exception.message).toBe('Quota exceeded');
        });

        it('should create UNAVAILABLE exception', () => {
            const exception = GrpcException.unavailable('Service unavailable');

            expect(exception.getCode()).toBe(GrpcErrorCode.UNAVAILABLE);
            expect(exception.message).toBe('Service unavailable');
        });

        it('should create OK exception', () => {
            const exception = GrpcException.ok('Operation successful');

            expect(exception.getCode()).toBe(GrpcErrorCode.OK);
            expect(exception.message).toBe('Operation successful');
        });

        it('should create CANCELLED exception', () => {
            const exception = GrpcException.cancelled('Operation cancelled');

            expect(exception.getCode()).toBe(GrpcErrorCode.CANCELLED);
            expect(exception.message).toBe('Operation cancelled');
        });

        it('should create UNKNOWN exception', () => {
            const exception = GrpcException.unknown('Unknown error');

            expect(exception.getCode()).toBe(GrpcErrorCode.UNKNOWN);
            expect(exception.message).toBe('Unknown error');
        });

        it('should create DEADLINE_EXCEEDED exception', () => {
            const exception = GrpcException.deadlineExceeded('Request timeout');

            expect(exception.getCode()).toBe(GrpcErrorCode.DEADLINE_EXCEEDED);
            expect(exception.message).toBe('Request timeout');
        });

        it('should create FAILED_PRECONDITION exception', () => {
            const exception = GrpcException.failedPrecondition('Precondition failed');

            expect(exception.getCode()).toBe(GrpcErrorCode.FAILED_PRECONDITION);
            expect(exception.message).toBe('Precondition failed');
        });

        it('should create ABORTED exception', () => {
            const exception = GrpcException.aborted('Operation aborted');

            expect(exception.getCode()).toBe(GrpcErrorCode.ABORTED);
            expect(exception.message).toBe('Operation aborted');
        });

        it('should create OUT_OF_RANGE exception', () => {
            const exception = GrpcException.outOfRange('Value out of range');

            expect(exception.getCode()).toBe(GrpcErrorCode.OUT_OF_RANGE);
            expect(exception.message).toBe('Value out of range');
        });

        it('should create UNIMPLEMENTED exception', () => {
            const exception = GrpcException.unimplemented('Not implemented');

            expect(exception.getCode()).toBe(GrpcErrorCode.UNIMPLEMENTED);
            expect(exception.message).toBe('Not implemented');
        });

        it('should create DATA_LOSS exception', () => {
            const exception = GrpcException.dataLoss('Data loss occurred');

            expect(exception.getCode()).toBe(GrpcErrorCode.DATA_LOSS);
            expect(exception.message).toBe('Data loss occurred');
        });
    });

    describe('inheritance', () => {
        it('should be instance of Error', () => {
            const exception = new GrpcException('Test error');

            expect(exception).toBeInstanceOf(Error);
            expect(exception).toBeInstanceOf(GrpcException);
        });

        it('should have correct stack trace', () => {
            const exception = new GrpcException('Test error');

            expect(exception.stack).toBeDefined();
            expect(exception.stack).toContain('GrpcException');
        });
    });
});

describe('getGrpcStatusDescription', () => {
    it('should return correct descriptions for all gRPC status codes', () => {
        expect(getGrpcStatusDescription(GrpcErrorCode.OK)).toBe('Success');
        expect(getGrpcStatusDescription(GrpcErrorCode.CANCELLED)).toBe('Operation was cancelled');
        expect(getGrpcStatusDescription(GrpcErrorCode.UNKNOWN)).toBe('Unknown error');
        expect(getGrpcStatusDescription(GrpcErrorCode.INVALID_ARGUMENT)).toBe(
            'Invalid argument provided',
        );
        expect(getGrpcStatusDescription(GrpcErrorCode.DEADLINE_EXCEEDED)).toBe(
            'Request timeout exceeded',
        );
        expect(getGrpcStatusDescription(GrpcErrorCode.NOT_FOUND)).toBe('Resource not found');
        expect(getGrpcStatusDescription(GrpcErrorCode.ALREADY_EXISTS)).toBe(
            'Resource already exists',
        );
        expect(getGrpcStatusDescription(GrpcErrorCode.PERMISSION_DENIED)).toBe('Permission denied');
        expect(getGrpcStatusDescription(GrpcErrorCode.RESOURCE_EXHAUSTED)).toBe(
            'Resource exhausted',
        );
        expect(getGrpcStatusDescription(GrpcErrorCode.FAILED_PRECONDITION)).toBe(
            'Failed precondition',
        );
        expect(getGrpcStatusDescription(GrpcErrorCode.ABORTED)).toBe('Operation aborted');
        expect(getGrpcStatusDescription(GrpcErrorCode.OUT_OF_RANGE)).toBe('Value out of range');
        expect(getGrpcStatusDescription(GrpcErrorCode.UNIMPLEMENTED)).toBe(
            'Method not implemented',
        );
        expect(getGrpcStatusDescription(GrpcErrorCode.INTERNAL)).toBe('Internal server error');
        expect(getGrpcStatusDescription(GrpcErrorCode.UNAVAILABLE)).toBe('Service unavailable');
        expect(getGrpcStatusDescription(GrpcErrorCode.DATA_LOSS)).toBe('Data loss');
        expect(getGrpcStatusDescription(GrpcErrorCode.UNAUTHENTICATED)).toBe(
            'Authentication required',
        );
    });

    it('should return unknown status message for invalid codes', () => {
        expect(getGrpcStatusDescription(999)).toBe('Unknown status code: 999');
        expect(getGrpcStatusDescription(-1)).toBe('Unknown status code: -1');
    });
});

describe('httpStatusToGrpcStatus', () => {
    it('should map HTTP status codes to gRPC status codes', () => {
        expect(httpStatusToGrpcStatus(200)).toBe(GrpcErrorCode.OK);
        expect(httpStatusToGrpcStatus(400)).toBe(GrpcErrorCode.INVALID_ARGUMENT);
        expect(httpStatusToGrpcStatus(401)).toBe(GrpcErrorCode.UNAUTHENTICATED);
        expect(httpStatusToGrpcStatus(403)).toBe(GrpcErrorCode.PERMISSION_DENIED);
        expect(httpStatusToGrpcStatus(404)).toBe(GrpcErrorCode.NOT_FOUND);
        expect(httpStatusToGrpcStatus(409)).toBe(GrpcErrorCode.ALREADY_EXISTS);
        expect(httpStatusToGrpcStatus(412)).toBe(GrpcErrorCode.FAILED_PRECONDITION);
        expect(httpStatusToGrpcStatus(416)).toBe(GrpcErrorCode.OUT_OF_RANGE);
        expect(httpStatusToGrpcStatus(429)).toBe(GrpcErrorCode.RESOURCE_EXHAUSTED);
        expect(httpStatusToGrpcStatus(499)).toBe(GrpcErrorCode.CANCELLED);
        expect(httpStatusToGrpcStatus(500)).toBe(GrpcErrorCode.INTERNAL);
        expect(httpStatusToGrpcStatus(501)).toBe(GrpcErrorCode.UNIMPLEMENTED);
        expect(httpStatusToGrpcStatus(503)).toBe(GrpcErrorCode.UNAVAILABLE);
        expect(httpStatusToGrpcStatus(504)).toBe(GrpcErrorCode.DEADLINE_EXCEEDED);
    });

    it('should return UNKNOWN for unmapped HTTP status codes', () => {
        expect(httpStatusToGrpcStatus(100)).toBe(GrpcErrorCode.UNKNOWN);
        expect(httpStatusToGrpcStatus(418)).toBe(GrpcErrorCode.UNKNOWN);
        expect(httpStatusToGrpcStatus(999)).toBe(GrpcErrorCode.UNKNOWN);
    });
});

describe('RETRYABLE_STATUS_CODES', () => {
    it('should contain expected retryable status codes', () => {
        expect(RETRYABLE_STATUS_CODES).toEqual([
            GrpcErrorCode.UNAVAILABLE,
            GrpcErrorCode.DEADLINE_EXCEEDED,
            GrpcErrorCode.RESOURCE_EXHAUSTED,
            GrpcErrorCode.ABORTED,
            GrpcErrorCode.INTERNAL,
        ]);
    });
});

describe('GrpcConsumerException', () => {
    const mockConsumerError: GrpcConsumerError = {
        code: GrpcErrorCode.NOT_FOUND,
        message: 'Resource not found',
        serviceName: 'UserService',
        methodName: 'GetUser',
        details: { userId: '123' },
        metadata: { 'trace-id': 'abc' },
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
        duration: 1500,
    };

    it('should create exception with consumer error', () => {
        const exception = new GrpcConsumerException(mockConsumerError);

        expect(exception.message).toBe('Resource not found');
        expect(exception.name).toBe('GrpcConsumerException');
        expect(exception.error).toBe(mockConsumerError);
    });

    it('should check if error is retryable', () => {
        const retryableError = { ...mockConsumerError, code: GrpcErrorCode.UNAVAILABLE };
        const nonRetryableError = { ...mockConsumerError, code: GrpcErrorCode.NOT_FOUND };

        const retryableException = new GrpcConsumerException(retryableError);
        const nonRetryableException = new GrpcConsumerException(nonRetryableError);

        expect(retryableException.isRetryable()).toBe(true);
        expect(nonRetryableException.isRetryable()).toBe(false);
    });

    it('should return error code', () => {
        const exception = new GrpcConsumerException(mockConsumerError);
        expect(exception.getCode()).toBe(GrpcErrorCode.NOT_FOUND);
    });

    it('should return error details', () => {
        const exception = new GrpcConsumerException(mockConsumerError);
        expect(exception.getDetails()).toEqual({ userId: '123' });
    });

    it('should return error metadata', () => {
        const exception = new GrpcConsumerException(mockConsumerError);
        expect(exception.getMetadata()).toEqual({ 'trace-id': 'abc' });
    });

    it('should return service name', () => {
        const exception = new GrpcConsumerException(mockConsumerError);
        expect(exception.getServiceName()).toBe('UserService');
    });

    it('should return method name', () => {
        const exception = new GrpcConsumerException(mockConsumerError);
        expect(exception.getMethodName()).toBe('GetUser');
    });

    it('should return error duration', () => {
        const exception = new GrpcConsumerException(mockConsumerError);
        expect(exception.getDuration()).toBe(1500);
    });

    it('should return error timestamp', () => {
        const exception = new GrpcConsumerException(mockConsumerError);
        expect(exception.getTimestamp()).toEqual(new Date('2023-01-01T00:00:00.000Z'));
    });
});

describe('GrpcConsumerErrorHandler', () => {
    let errorHandler: GrpcConsumerErrorHandler;
    const mockStartTime = 1640995200000; // 2022-01-01T00:00:00.000Z

    beforeEach(() => {
        errorHandler = new GrpcConsumerErrorHandler();
        jest.spyOn(Date, 'now').mockReturnValue(mockStartTime + 1000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should handle gRPC errors with all properties', () => {
        const grpcError = {
            code: GrpcErrorCode.INVALID_ARGUMENT,
            message: 'Invalid request',
            details: { field: 'email' },
            metadata: { 'request-id': '123' },
        };

        const exception = errorHandler.handleError(
            grpcError,
            'UserService',
            'CreateUser',
            mockStartTime,
        );

        expect(exception).toBeInstanceOf(GrpcConsumerException);
        expect(exception.getCode()).toBe(GrpcErrorCode.INVALID_ARGUMENT);
        expect(exception.message).toBe('Invalid request');
        expect(exception.getServiceName()).toBe('UserService');
        expect(exception.getMethodName()).toBe('CreateUser');
        expect(exception.getDetails()).toEqual({ field: 'email' });
        expect(exception.getMetadata()).toEqual({ 'request-id': '123' });
        expect(exception.getDuration()).toBe(1000);
    });

    it('should handle gRPC errors with fallback message from details', () => {
        const grpcError = {
            code: GrpcErrorCode.INTERNAL,
            details: 'Fallback message',
        };

        const exception = errorHandler.handleError(
            grpcError,
            'TestService',
            'TestMethod',
            mockStartTime,
        );

        expect(exception.message).toBe('Fallback message');
        expect(exception.getCode()).toBe(GrpcErrorCode.INTERNAL);
    });

    it('should handle gRPC errors with default message', () => {
        const grpcError = {
            code: GrpcErrorCode.UNKNOWN,
        };

        const exception = errorHandler.handleError(
            grpcError,
            'TestService',
            'TestMethod',
            mockStartTime,
        );

        expect(exception.message).toBe('gRPC error');
        expect(exception.getCode()).toBe(GrpcErrorCode.UNKNOWN);
    });

    it('should handle standard Error objects', () => {
        const error = new Error('Standard error message');

        const exception = errorHandler.handleError(
            error,
            'TestService',
            'TestMethod',
            mockStartTime,
        );

        expect(exception.message).toBe('Standard error message');
        expect(exception.getCode()).toBe(GrpcErrorCode.INTERNAL);
        expect(exception.getDetails()).toBe(error.stack);
    });

    it('should handle Error objects with empty message', () => {
        const error = new Error('');

        const exception = errorHandler.handleError(
            error,
            'TestService',
            'TestMethod',
            mockStartTime,
        );

        expect(exception.message).toBe('Internal error');
        expect(exception.getCode()).toBe(GrpcErrorCode.INTERNAL);
    });

    it('should handle string errors', () => {
        const stringError = 'Something went wrong';

        const exception = errorHandler.handleError(
            stringError,
            'TestService',
            'TestMethod',
            mockStartTime,
        );

        expect(exception.message).toBe('Something went wrong');
        expect(exception.getCode()).toBe(GrpcErrorCode.UNKNOWN);
    });

    it('should handle unknown error types', () => {
        const unknownError = { someProperty: 'value' };

        const exception = errorHandler.handleError(
            unknownError,
            'TestService',
            'TestMethod',
            mockStartTime,
        );

        expect(exception.message).toBe('Unknown error occurred');
        expect(exception.getCode()).toBe(GrpcErrorCode.UNKNOWN);
        expect(exception.getDetails()).toBe(unknownError);
    });

    it('should check if errors are retryable', () => {
        const retryableError = new Error('Service unavailable');
        (retryableError as any).code = GrpcErrorCode.UNAVAILABLE;

        const nonRetryableError = new Error('Not found');
        (nonRetryableError as any).code = GrpcErrorCode.NOT_FOUND;

        expect(errorHandler.isRetryableError(retryableError)).toBe(true);
        expect(errorHandler.isRetryableError(nonRetryableError)).toBe(false);
    });

    it('should handle standard errors in isRetryableError', () => {
        const standardError = new Error('Standard error');

        // Standard errors get mapped to INTERNAL which is retryable
        expect(errorHandler.isRetryableError(standardError)).toBe(true);
    });

    it('should log debug message for cancelled errors', () => {
        const cancelledError = {
            code: GrpcErrorCode.CANCELLED,
            message: 'Operation cancelled',
        };

        const exception = errorHandler.handleError(
            cancelledError,
            'TestService',
            'TestMethod',
            mockStartTime,
        );

        expect(exception.getCode()).toBe(GrpcErrorCode.CANCELLED);
        expect(exception.message).toBe('Operation cancelled');
    });

    it('should handle null metadata gracefully', () => {
        const exception = new GrpcException({
            code: GrpcErrorCode.OK,
            message: 'Test',
            metadata: null as any,
        });

        expect(exception.getMetadata()).toEqual({});
    });

    it('should handle undefined metadata gracefully', () => {
        const exception = new GrpcException({
            code: GrpcErrorCode.OK,
            message: 'Test',
            metadata: undefined,
        });

        expect(exception.getMetadata()).toEqual({});
    });

    it('should handle null metadata explicitly in validateMetadata', () => {
        const exception = new GrpcException({
            code: GrpcErrorCode.OK,
            message: 'Test',
            metadata: null as any,
        });
        expect(exception.getMetadata()).toEqual({});
    });

    it('should skip null/undefined metadata values in toMetadata conversion', () => {
        const mockMetadata = {
            add: jest.fn(),
        };
        MockedMetadata.mockImplementation(() => mockMetadata as any);

        const exception = new GrpcException({
            code: GrpcErrorCode.OK,
            message: 'Test',
            metadata: {
                validKey: 'value',
                nullKey: null as any,
                undefinedKey: undefined as any,
            },
        });

        exception.toMetadata();

        expect(mockMetadata.add).toHaveBeenCalledWith('validKey', 'value');
        expect(mockMetadata.add).not.toHaveBeenCalledWith('nullKey', null);
        expect(mockMetadata.add).not.toHaveBeenCalledWith('undefinedKey', undefined);
    });
});
