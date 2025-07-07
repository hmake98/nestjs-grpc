import * as services from '../../src/services';

describe('services/index', () => {
    it('should export all services', () => {
        expect(services.GrpcClientService).toBeDefined();
        expect(services.ProtoLoaderService).toBeDefined();
    });
});