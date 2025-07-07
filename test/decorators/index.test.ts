import * as decorators from '../../src/decorators';

describe('decorators/index', () => {
    it('should export all decorators', () => {
        expect(decorators.GrpcMethod).toBeDefined();
        expect(decorators.GrpcService).toBeDefined();
        expect(decorators.GrpcController).toBeDefined();
    });
});