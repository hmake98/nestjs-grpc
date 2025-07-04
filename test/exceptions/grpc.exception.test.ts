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

            // Should create exception but warn about invalid metadata
            expect(exception).toBeDefined();
            expect(console.warn).toHaveBeenCalled();
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

            expect(console.warn).toHaveBeenCalledWith(
                'Error converting metadata:',
                'Metadata error',
            );
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

    describe('toJSON', () => {
        it('should convert to JSON format', () => {
            const exception = new GrpcException({
                code: GrpcErrorCode.DEADLINE_EXCEEDED,
                message: 'Request timeout',
                details: { timeout: 5000 },
                metadata: { 'request-id': 'req123' },
            });

            const json = exception.toJSON();

            expect(json).toEqual({
                name: 'GrpcException',
                code: GrpcErrorCode.DEADLINE_EXCEEDED,
                message: 'Request timeout',
                details: { timeout: 5000 },
                metadata: { 'request-id': 'req123' },
            });
        });

        it('should handle serialization errors gracefully', () => {
            const exception = new GrpcException('Test error');

            // Mock details to cause JSON error
            Object.defineProperty(exception, 'details', {
                get: () => {
                    throw new Error('Serialization error');
                },
            });

            const json = exception.toJSON();

            expect(json.name).toBe('GrpcException');
            expect(json.message).toBe('Test error');
            expect(json.details).toBeNull();
            expect(json.metadata).toEqual({});
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
