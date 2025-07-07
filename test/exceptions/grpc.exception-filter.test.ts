import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';

import { GrpcExceptionFilter } from '../../src/exceptions/grpc.exception-filter';
import { GrpcException } from '../../src/exceptions/grpc.exception';
import { GrpcErrorCode } from '../../src/constants';

describe('GrpcExceptionFilter', () => {
    let filter: GrpcExceptionFilter;
    let mockHost: ArgumentsHost;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GrpcExceptionFilter],
        }).compile();

        filter = module.get<GrpcExceptionFilter>(GrpcExceptionFilter);
        mockHost = {
            switchToRpc: jest.fn(),
            switchToHttp: jest.fn(),
            switchToWs: jest.fn(),
            getArgs: jest.fn(),
            getArgByIndex: jest.fn(),
            getType: jest.fn(),
        };
    });

    describe('catch', () => {
        it('should handle GrpcException', done => {
            const grpcException = new GrpcException({
                code: GrpcErrorCode.INVALID_ARGUMENT,
                message: 'Invalid argument provided',
            });

            const result = filter.catch(grpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error).toBeDefined();
                    expect(error.code).toBe(GrpcErrorCode.INVALID_ARGUMENT);
                    expect(error.message).toBe('Invalid argument provided');
                    expect(error.details).toBeNull();
                    expect(error.metadata).toBeDefined();
                    done();
                },
            });
        });

        it('should handle generic RpcException', done => {
            const rpcException = new RpcException('Generic error');

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error).toBeDefined();
                    expect(error.code).toBe(GrpcErrorCode.UNKNOWN);
                    expect(error.message).toBe('Generic error');
                    done();
                },
            });
        });

        it('should handle HttpException', done => {
            const httpException = new HttpException('Not found', HttpStatus.NOT_FOUND);
            const rpcException = new RpcException(httpException);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error).toBeDefined();
                    expect(error.code).toBe(5); // NOT_FOUND status code
                    expect(error.message).toBe('Not found');
                    done();
                },
            });
        });

        it('should handle unknown exceptions with fallback', done => {
            const unknownException = new Error('Unknown error') as any;

            const result = filter.catch(unknownException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error).toBeDefined();
                    expect(error.code).toBe(GrpcErrorCode.INTERNAL);
                    done();
                },
            });
        });

        it('should handle filter errors gracefully', done => {
            const mockException = {
                getError: jest.fn().mockImplementation(() => {
                    throw new Error('Filter error');
                }),
            } as any;

            const result = filter.catch(mockException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error).toBeDefined();
                    expect(error.code).toBe(GrpcErrorCode.INTERNAL);
                    done();
                },
            });
        });
    });

    describe('error processing', () => {
        it('should preserve metadata from GrpcException', done => {
            const grpcException = new GrpcException({
                code: GrpcErrorCode.UNAUTHENTICATED,
                message: 'Authentication required',
                metadata: { 'auth-token': 'required' },
            });

            const result = filter.catch(grpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.metadata).toBeDefined();
                    done();
                },
            });
        });

        it('should handle complex error scenarios', done => {
            const complexError = new RpcException({
                code: GrpcErrorCode.RESOURCE_EXHAUSTED,
                message: 'Rate limit exceeded',
                details: 'Too many requests',
            });

            const result = filter.catch(complexError, mockHost);

            result.subscribe({
                error: error => {
                    expect(error).toBeDefined();
                    done();
                },
            });
        });

        it('should handle error objects with status property', done => {
            const errorWithStatus = { status: 400, message: 'Bad request' };
            const rpcException = new RpcException(errorWithStatus);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(3); // INVALID_ARGUMENT
                    expect(error.message).toBe('Bad request');
                    done();
                },
            });
        });

        it('should handle error objects with numeric status string', done => {
            const errorWithStatus = { status: '404', message: 'Not found' };
            const rpcException = new RpcException(errorWithStatus);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(5); // NOT_FOUND
                    expect(error.message).toBe('Not found');
                    done();
                },
            });
        });

        it('should handle error objects with invalid status', done => {
            const errorWithStatus = { status: 'invalid', message: 'Error' };
            const rpcException = new RpcException(errorWithStatus);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(2); // UNKNOWN
                    expect(error.message).toBe('Error');
                    done();
                },
            });
        });

        it('should handle error objects with error property', done => {
            const errorWithError = { error: 'Custom error message' };
            const rpcException = new RpcException(errorWithError);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(2); // UNKNOWN
                    expect(error.message).toBe('Custom error message');
                    done();
                },
            });
        });

        it('should handle primitive error values', done => {
            const rpcException = new RpcException('Simple string error');

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(2); // UNKNOWN
                    expect(error.message).toBe('Simple string error');
                    done();
                },
            });
        });

        it('should handle HttpException with response object', done => {
            const httpException = new HttpException(
                {
                    message: 'Validation failed',
                    errors: ['field1 is required', 'field2 is invalid'],
                },
                HttpStatus.BAD_REQUEST,
            );
            const rpcException = new RpcException(httpException);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(3); // INVALID_ARGUMENT
                    expect(error.details).toBeDefined();
                    done();
                },
            });
        });

        it('should handle various HTTP status codes', done => {
            const testCases = [
                { status: HttpStatus.UNAUTHORIZED, expectedCode: 16 }, // UNAUTHENTICATED
                { status: HttpStatus.FORBIDDEN, expectedCode: 7 }, // PERMISSION_DENIED
                { status: HttpStatus.CONFLICT, expectedCode: 6 }, // ALREADY_EXISTS
                { status: HttpStatus.TOO_MANY_REQUESTS, expectedCode: 8 }, // RESOURCE_EXHAUSTED
                { status: HttpStatus.INTERNAL_SERVER_ERROR, expectedCode: 13 }, // INTERNAL
                { status: HttpStatus.NOT_IMPLEMENTED, expectedCode: 12 }, // UNIMPLEMENTED
                { status: HttpStatus.SERVICE_UNAVAILABLE, expectedCode: 14 }, // UNAVAILABLE
                { status: HttpStatus.REQUEST_TIMEOUT, expectedCode: 4 }, // DEADLINE_EXCEEDED
                { status: HttpStatus.PRECONDITION_FAILED, expectedCode: 9 }, // FAILED_PRECONDITION
                { status: HttpStatus.PAYLOAD_TOO_LARGE, expectedCode: 8 }, // RESOURCE_EXHAUSTED
                { status: HttpStatus.UNPROCESSABLE_ENTITY, expectedCode: 3 }, // INVALID_ARGUMENT
                { status: HttpStatus.EXPECTATION_FAILED, expectedCode: 9 }, // FAILED_PRECONDITION
                { status: HttpStatus.I_AM_A_TEAPOT, expectedCode: 12 }, // UNIMPLEMENTED
                { status: HttpStatus.MISDIRECTED, expectedCode: 3 }, // INVALID_ARGUMENT
            ];

            let completed = 0;
            const total = testCases.length;

            testCases.forEach(({ status, expectedCode }) => {
                const httpException = new HttpException('Test error', status);
                const rpcException = new RpcException(httpException);
                const result = filter.catch(rpcException, mockHost);

                result.subscribe({
                    error: error => {
                        expect(error.code).toBe(expectedCode);
                        completed++;
                        if (completed === total) {
                            done();
                        }
                    },
                });
            });
        });

        it('should handle invalid status codes with fallback', done => {
            const invalidStatusCodes = [99, 600, -1, 0.5, 'invalid'];
            let completed = 0;
            const total = invalidStatusCodes.length;

            invalidStatusCodes.forEach(invalidStatus => {
                const httpException = new HttpException('Test error', invalidStatus as any);
                const rpcException = new RpcException(httpException);
                const result = filter.catch(rpcException, mockHost);

                result.subscribe({
                    error: error => {
                        expect(error.code).toBe(2); // UNKNOWN
                        completed++;
                        if (completed === total) {
                            done();
                        }
                    },
                });
            });
        });

        it('should handle empty and invalid messages', done => {
            const testCases = [
                { message: '', expected: 'An error occurred' },
                { message: '   ', expected: 'An error occurred' },
                { message: null, expected: 'An error occurred' },
                { message: undefined, expected: 'An error occurred' },
                { message: 123, expected: 'An error occurred' },
                { message: 'a'.repeat(1500), expected: 'a'.repeat(1000) }, // Should be truncated
            ];

            let completed = 0;
            const total = testCases.length;

            testCases.forEach(({ message, expected }) => {
                const rpcException = new RpcException(message as any);
                const result = filter.catch(rpcException, mockHost);

                result.subscribe({
                    error: error => {
                        expect(error.message).toBe(expected);
                        completed++;
                        if (completed === total) {
                            done();
                        }
                    },
                });
            });
        });

        it('should handle circular reference objects in details', done => {
            const circularObj: any = { name: 'test' };
            circularObj.self = circularObj;
            const rpcException = new RpcException(circularObj);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.details).toBeDefined();
                    expect(error.details.name).toBe('test');
                    done();
                },
            });
        });

        it('should handle non-serializable objects in details', done => {
            const nonSerializableObj = {
                func: () => 'test',
                symbol: Symbol('test'),
                bigint: BigInt(123),
            };
            const rpcException = new RpcException(nonSerializableObj);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.details).toBeDefined();
                    done();
                },
            });
        });

        it('should handle GrpcException with invalid status code', done => {
            const grpcException = new GrpcException({
                code: 999 as any, // Invalid gRPC status code
                message: 'Test error',
            });

            const result = filter.catch(grpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(2); // Should fallback to UNKNOWN
                    done();
                },
            });
        });

        it('should handle GrpcException with invalid metadata', done => {
            const grpcException = new GrpcException({
                code: GrpcErrorCode.INTERNAL,
                message: 'Test error',
                metadata: 'invalid-metadata' as any,
            });

            const result = filter.catch(grpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.metadata).toBeDefined();
                    done();
                },
            });
        });

        it('should handle exception when getError throws', done => {
            const mockRpcException = {
                getError: jest.fn().mockImplementation(() => {
                    throw new Error('getError failed');
                }),
            } as any;

            const result = filter.catch(mockRpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(13); // INTERNAL
                    expect(error.message).toBe('Internal server error occurred');
                    done();
                },
            });
        });

        it('should handle exception when processing GrpcException throws', done => {
            const mockGrpcException = {
                getCode: jest.fn().mockImplementation(() => {
                    throw new Error('getCode failed');
                }),
                message: 'test',
            } as any;

            // Make it pass instanceof check
            Object.setPrototypeOf(mockGrpcException, GrpcException.prototype);

            const result = filter.catch(mockGrpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(13); // INTERNAL
                    expect(error.message).toBe('Internal server error occurred');
                    done();
                },
            });
        });

        it('should handle completely invalid details object', done => {
            const objWithInvalidProps = {
                name: 'test',
                invalidProp: {
                    toString: () => {
                        throw new Error('toString failed');
                    },
                },
            };
            const rpcException = new RpcException(objWithInvalidProps);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.details).toEqual({ error: 'Details could not be serialized' });
                    done();
                },
            });
        });

        it('should handle primitive error values that are not objects', done => {
            const rpcException = new RpcException('null');

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(2); // UNKNOWN
                    expect(error.message).toBe('null');
                    done();
                },
            });
        });

        it('should handle metadata add errors gracefully', done => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const mockMetadata = {
                add: jest.fn().mockImplementation(() => {
                    throw new Error('metadata add failed');
                }),
            };

            // Mock the Metadata constructor to return our mock
            const originalMetadata = require('@grpc/grpc-js').Metadata;
            require('@grpc/grpc-js').Metadata = jest.fn().mockImplementation(() => mockMetadata);

            const httpException = new HttpException('Test error', HttpStatus.BAD_REQUEST);
            const rpcException = new RpcException(httpException);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(consoleSpy).toHaveBeenCalledWith(
                        expect.stringContaining('Error adding metadata'),
                    );
                    expect(error.code).toBe(3); // INVALID_ARGUMENT

                    // Restore original
                    require('@grpc/grpc-js').Metadata = originalMetadata;
                    consoleSpy.mockRestore();
                    done();
                },
            });
        });

        it('should handle HTTP status code edge cases', done => {
            const testCases = [
                { status: HttpStatus.GONE, expectedCode: 5 }, // NOT_FOUND (410)
                { status: HttpStatus.BAD_GATEWAY, expectedCode: 14 }, // UNAVAILABLE (502)
                { status: HttpStatus.GATEWAY_TIMEOUT, expectedCode: 14 }, // UNAVAILABLE (504)
                { status: 450, expectedCode: 3 }, // 4xx range -> INVALID_ARGUMENT
                { status: 550, expectedCode: 13 }, // 5xx range -> INTERNAL
                { status: 200, expectedCode: 2 }, // Default case -> UNKNOWN
            ];

            let completed = 0;
            const total = testCases.length;

            testCases.forEach(({ status, expectedCode }) => {
                const httpException = new HttpException('Test error', status);
                const rpcException = new RpcException(httpException);
                const result = filter.catch(rpcException, mockHost);

                result.subscribe({
                    error: error => {
                        expect(error.code).toBe(expectedCode);
                        completed++;
                        if (completed === total) {
                            done();
                        }
                    },
                });
            });
        });

        it('should handle parseHttpStatus with non-positive numbers', done => {
            const errorWithStatus = { status: -1, message: 'Negative status' };
            const rpcException = new RpcException(errorWithStatus);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(2); // UNKNOWN (invalid status)
                    expect(error.message).toBe('Negative status');
                    done();
                },
            });
        });

        it('should handle parseHttpStatus with invalid string', done => {
            const errorWithStatus = { status: 'abc', message: 'String status' };
            const rpcException = new RpcException(errorWithStatus);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.code).toBe(2); // UNKNOWN (invalid status)
                    expect(error.message).toBe('String status');
                    done();
                },
            });
        });

        it('should handle details that are primitive values', done => {
            const rpcException = new RpcException('42');

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.details).toEqual({ value: '42' });
                    done();
                },
            });
        });

        it('should handle null and undefined details', done => {
            const testCases = ['null', 'undefined'];
            let completed = 0;
            const total = testCases.length;

            testCases.forEach(detailsValue => {
                const rpcException = new RpcException(detailsValue);
                const result = filter.catch(rpcException, mockHost);

                result.subscribe({
                    error: error => {
                        expect(error.details).toBeNull();
                        completed++;
                        if (completed === total) {
                            done();
                        }
                    },
                });
            });
        });

        it('should handle objects with mixed property types in details', done => {
            const complexObj = {
                stringProp: 'test',
                numberProp: 123,
                booleanProp: true,
                nullProp: null,
                undefinedProp: undefined,
                objectProp: { nested: 'value' },
            };
            const rpcException = new RpcException(complexObj);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(error.details).toBeDefined();
                    expect(error.details.stringProp).toBe('test');
                    expect(error.details.numberProp).toBe(123);
                    expect(error.details.booleanProp).toBe(true);
                    expect(error.details.nullProp).toBeNull();
                    expect(error.details.undefinedProp).toBeUndefined();
                    expect(error.details.objectProp).toBe('[object Object]');
                    done();
                },
            });
        });

        it('should log warning for invalid gRPC status codes', done => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const grpcException = new GrpcException({
                code: -5 as any, // Invalid negative code
                message: 'Test error',
            });

            const result = filter.catch(grpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(consoleSpy).toHaveBeenCalledWith(
                        expect.stringContaining('Invalid gRPC status code'),
                    );
                    expect(error.code).toBe(2); // Should fallback to UNKNOWN
                    consoleSpy.mockRestore();
                    done();
                },
            });
        });

        it('should log warning for invalid HTTP status codes in mapping', done => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const httpException = new HttpException('Test error', 99); // Invalid HTTP status
            const rpcException = new RpcException(httpException);

            const result = filter.catch(rpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(consoleSpy).toHaveBeenCalledWith(
                        expect.stringContaining('Invalid HTTP status code'),
                    );
                    expect(error.code).toBe(2); // Should fallback to UNKNOWN
                    consoleSpy.mockRestore();
                    done();
                },
            });
        });

        it('should handle integer vs non-integer status codes', done => {
            const testCases = [
                { status: 0.5, shouldLog: true }, // Non-integer
                { status: 400, shouldLog: false }, // Valid integer
                { status: '400.5', shouldLog: true }, // Non-integer string
            ];

            let completed = 0;
            const total = testCases.length;

            testCases.forEach(({ status, shouldLog }) => {
                const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

                const httpException = new HttpException('Test error', status as any);
                const rpcException = new RpcException(httpException);
                const result = filter.catch(rpcException, mockHost);

                result.subscribe({
                    error: error => {
                        if (shouldLog) {
                            expect(consoleSpy).toHaveBeenCalledWith(
                                expect.stringContaining('Invalid HTTP status code'),
                            );
                        }
                        consoleSpy.mockRestore();
                        completed++;
                        if (completed === total) {
                            done();
                        }
                    },
                });
            });
        });

        it('should log warning for invalid metadata', done => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const grpcException = new GrpcException({
                code: GrpcErrorCode.INTERNAL,
                message: 'Test error',
                metadata: { invalid: 'object' } as any,
            });

            const result = filter.catch(grpcException, mockHost);

            result.subscribe({
                error: error => {
                    expect(consoleSpy).toHaveBeenCalledWith(
                        expect.stringContaining('Invalid metadata provided'),
                    );
                    expect(error.metadata).toBeDefined();
                    consoleSpy.mockRestore();
                    done();
                },
            });
        });
    });
});
