import { GrpcController } from '../../src/decorators/grpc-controller.decorator';
import { GrpcMethod } from '../../src/decorators/grpc-method.decorator';
import { GrpcService, InjectGrpcClient } from '../../src/decorators/grpc-service.decorator';
import {
    GRPC_CONTROLLER_METADATA,
    GRPC_METHOD_METADATA,
    GRPC_SERVICE_METADATA,
    GRPC_CLIENT_TOKEN_PREFIX,
} from '../../src/constants';

describe('Decorators', () => {
    describe('GrpcController', () => {
        it('should set controller metadata with string service name', () => {
            @GrpcController('TestService')
            class TestController {}

            const metadata = Reflect.getMetadata(GRPC_CONTROLLER_METADATA, TestController);
            expect(metadata).toEqual({ serviceName: 'TestService' });
        });

        it('should set controller metadata with options object', () => {
            const options = {
                serviceName: 'TestService',
                package: 'test.package',
                url: 'localhost:50051',
            };

            @GrpcController(options)
            class TestController {}

            const metadata = Reflect.getMetadata(GRPC_CONTROLLER_METADATA, TestController);
            expect(metadata).toEqual(options);
        });
    });

    describe('GrpcMethod', () => {
        it('should set method metadata with default options', () => {
            const TestController = class {
                testMethod(): any {}
            };

            // Apply decorator manually
            const decorator = GrpcMethod();
            decorator(TestController.prototype, 'testMethod', {} as PropertyDescriptor);

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestController.prototype,
                'testMethod',
            );
            expect(metadata).toEqual({ methodName: 'testMethod' });
        });

        it('should set method metadata with string method name', () => {
            const TestController = class {
                testMethod(): any {}
            };

            // Apply decorator manually
            const decorator = GrpcMethod('CustomMethod');
            decorator(TestController.prototype, 'testMethod', {} as PropertyDescriptor);

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestController.prototype,
                'testMethod',
            );
            expect(metadata).toEqual({ methodName: 'CustomMethod' });
        });

        it('should set method metadata with options object', () => {
            const options = {
                methodName: 'CustomMethod',
                streaming: true,
                timeout: 5000,
            };

            const TestController = class {
                testMethod(): any {}
            };

            // Apply decorator manually
            const decorator = GrpcMethod(options);
            decorator(TestController.prototype, 'testMethod', {} as PropertyDescriptor);

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestController.prototype,
                'testMethod',
            );
            expect(metadata).toEqual(options);
        });
    });

    describe('GrpcService', () => {
        it('should set service metadata with string service name', () => {
            @GrpcService('TestService')
            class TestServiceClient {}

            const metadata = Reflect.getMetadata(GRPC_SERVICE_METADATA, TestServiceClient);
            expect(metadata).toEqual({ serviceName: 'TestService' });
        });

        it('should set service metadata with options object', () => {
            const options = {
                serviceName: 'TestService',
                package: 'test.package',
                url: 'localhost:50051',
                clientOptions: { timeout: 5000 },
            };

            @GrpcService(options)
            class TestServiceClient {}

            const metadata = Reflect.getMetadata(GRPC_SERVICE_METADATA, TestServiceClient);
            expect(metadata).toEqual(options);
        });
    });

    describe('InjectGrpcClient', () => {
        it('should create injection token for service', () => {
            const token = `${GRPC_CLIENT_TOKEN_PREFIX}TestService`;

            // Mock Reflect.defineMetadata to capture the parameters
            const defineMetadataSpy = jest.spyOn(Reflect, 'defineMetadata');

            class TestClass {
                constructor(@InjectGrpcClient('TestService') private client: any) {}
            }

            // Check that the injection token was used
            expect(defineMetadataSpy).toHaveBeenCalledWith(
                'self:paramtypes',
                [{ index: 0, param: 'GRPC_CLIENT_TestService' }],
                TestClass,
            );

            defineMetadataSpy.mockRestore();
        });

        it('should throw error for empty service name', () => {
            expect(() => {
                InjectGrpcClient('');
            }).toThrow('Service name is required for @InjectGrpcClient');
        });

        it('should throw error for non-string service name', () => {
            expect(() => {
                InjectGrpcClient(null as any);
            }).toThrow('Service name is required for @InjectGrpcClient');
        });
    });
});
