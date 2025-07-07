import * as exceptions from '../../src/exceptions';

describe('exceptions/index', () => {
    it('should export all exceptions', () => {
        expect(exceptions.GrpcException).toBeDefined();
        expect(exceptions.GrpcExceptionFilter).toBeDefined();
    });
});