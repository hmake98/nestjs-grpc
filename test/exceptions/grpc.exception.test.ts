import { Metadata } from '@grpc/grpc-js';
import { GrpcException } from '../../src/exceptions/grpc.exception';
import { GrpcErrorCode } from '../../src/constants';

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
            expect(() => new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: [] as any
            })).toThrow('Metadata must be an object');

            expect(() => new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: 'invalid' as any
            })).toThrow('Metadata must be an object');
        });

        it('should throw error for invalid metadata keys', () => {
            expect(() => new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: { '': 'value' } as any
            })).toThrow('Metadata keys must be non-empty strings');
        });

        it('should filter out invalid array values in metadata', () => {
            const exception = new GrpcException({
                code: GrpcErrorCode.OK,
                message: 'Test',
                metadata: { 
                    mixedArray: ['valid', 123, 'also-valid', null, Buffer.from('buf')] as any,
                    invalidArray: [123, null, undefined] as any
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
