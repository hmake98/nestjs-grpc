import { Test } from '@nestjs/testing';
import { GrpcExceptionFilter } from '../../exceptions/grpc.exception-filter';
import { GrpcException } from '../../exceptions/grpc.exception';
import { RpcException } from '@nestjs/microservices';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { GrpcErrorCode } from '../../constants';
import { Observable } from 'rxjs';
import { status } from '@grpc/grpc-js';

// Mock throwError from rxjs
jest.mock('rxjs', () => ({
    ...jest.requireActual('rxjs'),
    throwError: jest.fn().mockImplementation(factory => {
        const error = factory();
        return new Observable(subscriber => {
            subscriber.error(error);
        });
    }),
}));

describe('GrpcExceptionFilter', () => {
    let filter: GrpcExceptionFilter;
    let host: ArgumentsHost;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [GrpcExceptionFilter],
        }).compile();

        filter = module.get<GrpcExceptionFilter>(GrpcExceptionFilter);

        // Mock ArgumentsHost
        host = {
            switchToRpc: jest.fn().mockReturnThis(),
            getContext: jest.fn().mockReturnValue({}),
            getType: jest.fn(),
            switchToHttp: jest.fn(),
            switchToWs: jest.fn(),
        } as unknown as ArgumentsHost;
    });

    it('should handle GrpcException', () => {
        const exception = new GrpcException({
            code: GrpcErrorCode.NOT_FOUND,
            message: 'Resource not found',
            details: { id: '123' },
            metadata: { 'request-id': 'abc123' },
        });

        const observableError = filter.catch(exception, host);

        // Subscribe to the observable to get the error
        let caughtError: any;
        observableError.subscribe({
            error: err => {
                caughtError = err;
            },
        });

        expect(caughtError).toBeDefined();
        expect(caughtError.code).toBe(GrpcErrorCode.NOT_FOUND);
        expect(caughtError.message).toBe('Resource not found');
        expect(caughtError.details).toEqual({ id: '123' });
        expect(caughtError.metadata).toBeDefined();
    });

    it('should handle RpcException with HttpException', () => {
        const httpException = new HttpException('Not Found', HttpStatus.NOT_FOUND);
        const rpcException = new RpcException(httpException);

        const observableError = filter.catch(rpcException, host);

        let caughtError: any;
        observableError.subscribe({
            error: err => {
                caughtError = err;
            },
        });

        expect(caughtError).toBeDefined();
        expect(caughtError.code).toBe(status.NOT_FOUND);
        expect(caughtError.message).toBe('Not Found');
        expect(caughtError.metadata).toBeDefined();
        expect(caughtError.metadata.get('http-status')[0]).toBe('404');
    });

    it('should handle RpcException with generic error', () => {
        const genericError = new Error('Something went wrong');
        const rpcException = new RpcException(genericError);

        const observableError = filter.catch(rpcException, host);

        let caughtError: any;
        observableError.subscribe({
            error: err => {
                caughtError = err;
            },
        });

        expect(caughtError).toBeDefined();
        expect(caughtError.code).toBe(GrpcErrorCode.UNKNOWN);
        expect(caughtError.message).toBe('Something went wrong');
    });

    it('should handle RpcException with object error having status property', () => {
        const objectError = { status: 403, message: 'Forbidden' };
        const rpcException = new RpcException(objectError);

        const observableError = filter.catch(rpcException, host);

        let caughtError: any;
        observableError.subscribe({
            error: err => {
                caughtError = err;
            },
        });

        expect(caughtError).toBeDefined();
        expect(caughtError.code).toBe(status.PERMISSION_DENIED); // Mapped from HTTP 403
        expect(caughtError.message).toBe('Forbidden');
        expect(caughtError.metadata).toBeDefined();
        expect(caughtError.metadata.get('http-status')[0]).toBe('403');
    });

    describe('mapHttpToGrpcStatus', () => {
        it('should map HTTP statuses to gRPC statuses', () => {
            const testCases = [
                { http: HttpStatus.BAD_REQUEST, grpc: status.INVALID_ARGUMENT },
                { http: HttpStatus.UNAUTHORIZED, grpc: status.UNAUTHENTICATED },
                { http: HttpStatus.FORBIDDEN, grpc: status.PERMISSION_DENIED },
                { http: HttpStatus.NOT_FOUND, grpc: status.NOT_FOUND },
                { http: HttpStatus.CONFLICT, grpc: status.ALREADY_EXISTS },
                { http: HttpStatus.REQUEST_TIMEOUT, grpc: status.DEADLINE_EXCEEDED },
                { http: HttpStatus.PRECONDITION_FAILED, grpc: status.FAILED_PRECONDITION },
                { http: HttpStatus.PAYLOAD_TOO_LARGE, grpc: status.RESOURCE_EXHAUSTED },
                { http: HttpStatus.UNPROCESSABLE_ENTITY, grpc: status.INVALID_ARGUMENT },
                { http: HttpStatus.INTERNAL_SERVER_ERROR, grpc: status.INTERNAL },
                { http: HttpStatus.NOT_IMPLEMENTED, grpc: status.UNIMPLEMENTED },
                { http: HttpStatus.BAD_GATEWAY, grpc: status.UNAVAILABLE },
                { http: HttpStatus.SERVICE_UNAVAILABLE, grpc: status.UNAVAILABLE },
                { http: HttpStatus.GATEWAY_TIMEOUT, grpc: status.UNAVAILABLE },
                { http: 999, grpc: status.UNKNOWN }, // Unknown status
            ];

            testCases.forEach(testCase => {
                const exception = new HttpException('Test', testCase.http);
                const rpcException = new RpcException(exception);

                const observableError = filter.catch(rpcException, host);

                let caughtError: any;
                observableError.subscribe({
                    error: err => {
                        caughtError = err;
                    },
                });

                expect(caughtError.code).toBe(testCase.grpc);
            });
        });
    });
});
