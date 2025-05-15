import { GrpcException } from '../../exceptions/grpc.exception';
import { GrpcErrorCode } from '../../constants';
import { Metadata } from '@grpc/grpc-js';

describe('GrpcException', () => {
    describe('constructor', () => {
        it('should create an exception with string message', () => {
            const exception = new GrpcException('Test error');

            expect(exception.message).toBe('Test error');
            expect(exception.getCode()).toBe(GrpcErrorCode.UNKNOWN);
            expect(exception.getDetails()).toBeNull();
            expect(exception.getMetadata()).toEqual({});
        });

        it('should create an exception with options', () => {
            const options = {
                code: GrpcErrorCode.NOT_FOUND,
                message: 'Resource not found',
                details: { id: '123' },
                metadata: { 'request-id': 'abc123' },
            };

            const exception = new GrpcException(options);

            expect(exception.message).toBe('Resource not found');
            expect(exception.getCode()).toBe(GrpcErrorCode.NOT_FOUND);
            expect(exception.getDetails()).toEqual({ id: '123' });
            expect(exception.getMetadata()).toEqual({ 'request-id': 'abc123' });
        });

        it('should have the correct class name', () => {
            const exception = new GrpcException('Test error');
            expect(exception.name).toBe('GrpcException');
        });
    });

    describe('toMetadata', () => {
        it('should convert metadata object to gRPC Metadata', () => {
            const exception = new GrpcException({
                code: GrpcErrorCode.INVALID_ARGUMENT,
                message: 'Invalid input',
                metadata: {
                    'error-details': 'Field validation failed',
                    'failed-fields': ['name', 'email'],
                },
            });

            const metadata = exception.toMetadata();

            expect(metadata).toBeInstanceOf(Metadata);

            // Mock the get method for testing
            const originalGet = metadata.get;
            metadata.get = jest.fn().mockImplementation((key: string) => {
                if (key === 'error-details') return ['Field validation failed'];
                if (key === 'failed-fields') return ['name', 'email'];
                return [];
            });

            expect(metadata.get('error-details')).toEqual(['Field validation failed']);
            expect(metadata.get('failed-fields')).toEqual(['name', 'email']);

            // Restore original method
            metadata.get = originalGet;
        });
    });

    describe('getError', () => {
        it('should return the error as a plain object', () => {
            const errorDetails = {
                code: GrpcErrorCode.FAILED_PRECONDITION,
                message: 'Precondition failed',
                details: { condition: 'must be active' },
                metadata: { context: 'user-activation' },
            };

            const exception = new GrpcException(errorDetails);
            const error = exception.getError();

            expect(error).toEqual(errorDetails);
        });
    });

    describe('static methods', () => {
        it('should create NOT_FOUND exception', () => {
            const exception = GrpcException.notFound('User not found');

            expect(exception).toBeInstanceOf(GrpcException);
            expect(exception.message).toBe('User not found');
            expect(exception.getCode()).toBe(GrpcErrorCode.NOT_FOUND);
        });

        it('should create INVALID_ARGUMENT exception', () => {
            const exception = GrpcException.invalidArgument(
                'Invalid email',
                { field: 'email' },
                { 'validation-error': 'true' },
            );

            expect(exception).toBeInstanceOf(GrpcException);
            expect(exception.message).toBe('Invalid email');
            expect(exception.getCode()).toBe(GrpcErrorCode.INVALID_ARGUMENT);
            expect(exception.getDetails()).toEqual({ field: 'email' });
            expect(exception.getMetadata()).toEqual({ 'validation-error': 'true' });
        });

        it('should create ALREADY_EXISTS exception', () => {
            const exception = GrpcException.alreadyExists('User already exists');

            expect(exception).toBeInstanceOf(GrpcException);
            expect(exception.message).toBe('User already exists');
            expect(exception.getCode()).toBe(GrpcErrorCode.ALREADY_EXISTS);
        });

        it('should create PERMISSION_DENIED exception', () => {
            const exception = GrpcException.permissionDenied('Insufficient permissions');

            expect(exception).toBeInstanceOf(GrpcException);
            expect(exception.message).toBe('Insufficient permissions');
            expect(exception.getCode()).toBe(GrpcErrorCode.PERMISSION_DENIED);
        });

        it('should create INTERNAL exception', () => {
            const exception = GrpcException.internal('Internal server error');

            expect(exception).toBeInstanceOf(GrpcException);
            expect(exception.message).toBe('Internal server error');
            expect(exception.getCode()).toBe(GrpcErrorCode.INTERNAL);
        });
    });
});
