import * as decorators from '../../src/decorators';

describe('decorators/index', () => {
    it('should export all decorators', () => {
        expect(decorators.GrpcMethod).toBeDefined();
        expect(decorators.GrpcService).toBeDefined();
        expect(decorators.GrpcController).toBeDefined();
        expect(decorators.GrpcStream).toBeDefined();
        expect(decorators.InjectGrpcClient).toBeDefined();
        expect(decorators.GrpcPayload).toBeDefined();
        expect(decorators.GrpcStreamPayload).toBeDefined();
    });

    it('should export GrpcController', () => {
        expect(typeof decorators.GrpcController).toBe('function');
    });

    it('should export GrpcMethod', () => {
        expect(typeof decorators.GrpcMethod).toBe('function');
    });

    it('should export GrpcStream', () => {
        expect(typeof decorators.GrpcStream).toBe('function');
    });

    it('should export GrpcService', () => {
        expect(typeof decorators.GrpcService).toBe('function');
    });

    it('should export InjectGrpcClient', () => {
        expect(typeof decorators.InjectGrpcClient).toBe('function');
    });

    it('should export GrpcPayload', () => {
        expect(typeof decorators.GrpcPayload).toBe('function');
    });

    it('should export GrpcStreamPayload', () => {
        expect(typeof decorators.GrpcStreamPayload).toBe('function');
    });
});