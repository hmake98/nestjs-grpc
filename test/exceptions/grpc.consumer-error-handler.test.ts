import { GrpcConsumerErrorHandler } from '../../src/exceptions/grpc.exception';
import { GrpcErrorCode } from '../../src/constants';

describe('GrpcConsumerErrorHandler', () => {
    let handler: GrpcConsumerErrorHandler;

    beforeEach(() => {
        handler = new GrpcConsumerErrorHandler();
        jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('handles gRPC-style error objects', () => {
        const error = { code: GrpcErrorCode.UNAVAILABLE, message: 'down', details: 'x' };
        const ex = handler.handleError(error, 'Svc', 'Method', 0);
        expect(ex.getCode()).toBe(GrpcErrorCode.UNAVAILABLE);
        expect(ex.getServiceName()).toBe('Svc');
        expect(ex.getMethodName()).toBe('Method');
        expect(ex.getDuration()).toBe(1000);
        expect(ex.isRetryable()).toBe(true);
    });

    it('handles standard Error objects (retryable INTERNAL)', () => {
        const error = new Error('boom');
        const ex = handler.handleError(error, 'Svc', 'Method', 500);
        expect(ex.getCode()).toBe(GrpcErrorCode.INTERNAL);
        expect(ex.isRetryable()).toBe(true);
    });

    it('handles string errors', () => {
        const ex = handler.handleError('ouch', 'Svc', 'Method', 250);
        expect(ex.getCode()).toBe(GrpcErrorCode.UNKNOWN);
        expect(ex.getDetails()).toBeUndefined();
    });

    it('handles unknown error types', () => {
        const ex = handler.handleError({ some: 'obj' } as any, 'Svc', 'Method', 250);
        expect(ex.getCode()).toBe(GrpcErrorCode.UNKNOWN);
    });
});

describe('Status helpers', () => {
    const { getGrpcStatusDescription, httpStatusToGrpcStatus } = require('../../src/exceptions/grpc.exception');

    it('maps gRPC codes to descriptions', () => {
        expect(getGrpcStatusDescription(GrpcErrorCode.OK)).toContain('Success');
        expect(getGrpcStatusDescription(GrpcErrorCode.CANCELLED)).toContain('cancelled');
        expect(getGrpcStatusDescription(GrpcErrorCode.INVALID_ARGUMENT)).toContain('Invalid');
        expect(getGrpcStatusDescription(GrpcErrorCode.DEADLINE_EXCEEDED)).toContain('timeout');
        expect(getGrpcStatusDescription(GrpcErrorCode.NOT_FOUND)).toContain('not found');
        expect(getGrpcStatusDescription(GrpcErrorCode.ALREADY_EXISTS)).toContain('already');
        expect(getGrpcStatusDescription(GrpcErrorCode.PERMISSION_DENIED)).toContain('Permission');
        expect(getGrpcStatusDescription(GrpcErrorCode.RESOURCE_EXHAUSTED)).toContain('Resource');
        expect(getGrpcStatusDescription(GrpcErrorCode.FAILED_PRECONDITION)).toContain('precondition');
        expect(getGrpcStatusDescription(GrpcErrorCode.ABORTED)).toContain('aborted');
        expect(getGrpcStatusDescription(GrpcErrorCode.OUT_OF_RANGE)).toContain('range');
        expect(getGrpcStatusDescription(GrpcErrorCode.UNIMPLEMENTED)).toContain('implemented');
        expect(getGrpcStatusDescription(GrpcErrorCode.INTERNAL)).toContain('Internal');
        expect(getGrpcStatusDescription(GrpcErrorCode.UNAVAILABLE)).toContain('unavailable');
        expect(getGrpcStatusDescription(GrpcErrorCode.DATA_LOSS)).toContain('Data');
        expect(getGrpcStatusDescription(GrpcErrorCode.UNAUTHENTICATED)).toContain('Authentication');
        expect(getGrpcStatusDescription(999)).toContain('Unknown status code');
    });

    it('maps HTTP to gRPC codes', () => {
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
        expect(httpStatusToGrpcStatus(418)).toBe(GrpcErrorCode.UNKNOWN);
    });
});

