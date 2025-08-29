import * as exceptions from '../../src/exceptions';

describe('exceptions/index', () => {
    it('should export all exceptions', () => {
        expect(exceptions.GrpcException).toBeDefined();
        expect(exceptions.GrpcConsumerException).toBeDefined();
        expect(exceptions.GrpcConsumerErrorHandler).toBeDefined();
        expect(exceptions.getGrpcStatusDescription).toBeDefined();
        expect(exceptions.httpStatusToGrpcStatus).toBeDefined();
        expect(exceptions.RETRYABLE_STATUS_CODES).toBeDefined();
    });

    it('should export GrpcException', () => {
        expect(typeof exceptions.GrpcException).toBe('function');
    });

    it('should export GrpcConsumerException', () => {
        expect(typeof exceptions.GrpcConsumerException).toBe('function');
    });

    it('should export GrpcConsumerErrorHandler', () => {
        expect(typeof exceptions.GrpcConsumerErrorHandler).toBe('function');
    });

    it('should export getGrpcStatusDescription', () => {
        expect(typeof exceptions.getGrpcStatusDescription).toBe('function');
    });

    it('should export httpStatusToGrpcStatus', () => {
        expect(typeof exceptions.httpStatusToGrpcStatus).toBe('function');
    });

    it('should export RETRYABLE_STATUS_CODES', () => {
        expect(Array.isArray(exceptions.RETRYABLE_STATUS_CODES)).toBe(true);
    });
});
