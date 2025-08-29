import * as services from '../../src/services';

describe('services/index', () => {
    it('should export all services', () => {
        expect(services.GrpcClientService).toBeDefined();
        expect(services.GrpcRegistryService).toBeDefined();
        expect(services.GrpcProviderService).toBeDefined();
        expect(services.GrpcProtoService).toBeDefined();
        expect(services.GrpcControllerDiscoveryService).toBeDefined();
        expect(services.ProtoLoaderService).toBeDefined();
    });

    it('should export GrpcClientService', () => {
        expect(typeof services.GrpcClientService).toBe('function');
    });

    it('should export GrpcRegistryService', () => {
        expect(typeof services.GrpcRegistryService).toBe('function');
    });

    it('should export GrpcProviderService', () => {
        expect(typeof services.GrpcProviderService).toBe('function');
    });

    it('should export GrpcProtoService', () => {
        expect(typeof services.GrpcProtoService).toBe('function');
    });

    it('should export GrpcControllerDiscoveryService', () => {
        expect(typeof services.GrpcControllerDiscoveryService).toBe('function');
    });

    it('should export ProtoLoaderService as alias', () => {
        expect(services.ProtoLoaderService).toBe(services.GrpcProtoService);
        expect(typeof services.ProtoLoaderService).toBe('function');
    });
});