import { GrpcService, GrpcServiceOptions } from '../../decorators/grpc-service.decorator';
import { GRPC_SERVICE_METADATA } from '../../constants';

describe('GrpcService decorator', () => {
    describe('when used with string argument', () => {
        it('should set metadata with service name', () => {
            @GrpcService('TestService')
            class TestController {}

            const metadata = Reflect.getMetadata(GRPC_SERVICE_METADATA, TestController);

            expect(metadata).toBeDefined();
            expect(metadata.serviceName).toBe('TestService');
        });
    });

    describe('when used with options object', () => {
        it('should set metadata with options', () => {
            const options: GrpcServiceOptions = {
                serviceName: 'TestService',
                package: 'test.package',
            };

            @GrpcService(options)
            class TestController {}

            const metadata = Reflect.getMetadata(GRPC_SERVICE_METADATA, TestController);

            expect(metadata).toBeDefined();
            expect(metadata.serviceName).toBe('TestService');
            expect(metadata.package).toBe('test.package');
        });
    });
});
