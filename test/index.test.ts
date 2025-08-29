import * as mainIndex from '../src/index';

describe('src/index', () => {
    it('should export GrpcModule', () => {
        expect(mainIndex.GrpcModule).toBeDefined();
        expect(typeof mainIndex.GrpcModule).toBe('function');
    });

    it('should export GrpcErrorCode', () => {
        expect(mainIndex.GrpcErrorCode).toBeDefined();
        expect(typeof mainIndex.GrpcErrorCode).toBe('object');
    });

    it('should export decorators', () => {
        expect(mainIndex.GrpcController).toBeDefined();
        expect(mainIndex.GrpcMethod).toBeDefined();
        expect(typeof mainIndex.GrpcController).toBe('function');
        expect(typeof mainIndex.GrpcMethod).toBe('function');
    });

    it('should export GrpcException', () => {
        expect(mainIndex.GrpcException).toBeDefined();
        expect(typeof mainIndex.GrpcException).toBe('function');
    });

    it('should export services', () => {
        expect(mainIndex.GrpcClientService).toBeDefined();
        expect(mainIndex.GrpcRegistryService).toBeDefined();
        expect(mainIndex.GrpcProviderService).toBeDefined();
        expect(mainIndex.GrpcProtoService).toBeDefined();
        expect(typeof mainIndex.GrpcClientService).toBe('function');
        expect(typeof mainIndex.GrpcRegistryService).toBe('function');
        expect(typeof mainIndex.GrpcProviderService).toBe('function');
        expect(typeof mainIndex.GrpcProtoService).toBe('function');
    });

    it('should export GrpcLogger utility', () => {
        expect(mainIndex.GrpcLogger).toBeDefined();
        expect(typeof mainIndex.GrpcLogger).toBe('function');
    });

    it('should export consumer functionality', () => {
        expect(mainIndex.GrpcConsumerErrorHandler).toBeDefined();
        expect(mainIndex.GrpcConsumerException).toBeDefined();
        expect(mainIndex.getGrpcStatusDescription).toBeDefined();
        expect(mainIndex.httpStatusToGrpcStatus).toBeDefined();
        expect(mainIndex.RETRYABLE_STATUS_CODES).toBeDefined();
        expect(typeof mainIndex.GrpcConsumerErrorHandler).toBe('function');
        expect(typeof mainIndex.GrpcConsumerException).toBe('function');
        expect(typeof mainIndex.getGrpcStatusDescription).toBe('function');
        expect(typeof mainIndex.httpStatusToGrpcStatus).toBe('function');
        expect(Array.isArray(mainIndex.RETRYABLE_STATUS_CODES)).toBe(true);
    });

    it('should export generateCommand', () => {
        expect(mainIndex.generateCommand).toBeDefined();
        expect(typeof mainIndex.generateCommand).toBe('function');
    });

    it('should have reflect-metadata imported', () => {
        // This test ensures reflect-metadata is imported at the top
        // We can't directly test the import, but we can verify that
        // Reflect.getMetadata is available (which it provides)
        expect(typeof Reflect.getMetadata).toBe('function');
    });
});