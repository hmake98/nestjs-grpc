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
    });
});
