import { GrpcController } from '../../src/decorators/grpc-controller.decorator';
import { GrpcMethod } from '../../src/decorators/grpc-method.decorator';
import { GrpcStream } from '../../src/decorators/grpc-stream.decorator';
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

        it('should throw error for invalid service name', () => {
            expect(() => {
                @GrpcController('' as any)
                class TestController {}
            }).toThrow('Service name is required and must be a string');
        });

        it('should throw error for non-string service name', () => {
            expect(() => {
                @GrpcController(null as any)
                class TestController {}
            }).toThrow();
        });

        it('should throw error when applied to non-class', () => {
            const decorator = GrpcController('TestService');
            expect(() => {
                decorator(null as any);
            }).toThrow('@GrpcController can only be applied to classes');
        });
    });

    describe('GrpcMethod', () => {
        it('should set method metadata with default options', () => {
            const TestController = class {
                testMethod(): any {}
            };

            // Create proper method descriptor
            const descriptor: PropertyDescriptor = {
                value: TestController.prototype.testMethod,
                writable: true,
                enumerable: false,
                configurable: true,
            };

            // Apply decorator manually
            const decorator = GrpcMethod();
            decorator(TestController.prototype, 'testMethod', descriptor);

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

            // Create proper method descriptor
            const descriptor: PropertyDescriptor = {
                value: TestController.prototype.testMethod,
                writable: true,
                enumerable: false,
                configurable: true,
            };

            // Apply decorator manually
            const decorator = GrpcMethod('CustomMethod');
            decorator(TestController.prototype, 'testMethod', descriptor);

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

            // Create proper method descriptor
            const descriptor: PropertyDescriptor = {
                value: TestController.prototype.testMethod,
                writable: true,
                enumerable: false,
                configurable: true,
            };

            // Apply decorator manually
            const decorator = GrpcMethod(options);
            decorator(TestController.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestController.prototype,
                'testMethod',
            );
            expect(metadata).toEqual(options);
        });

        it('should throw error when applied to non-method', () => {
            const TestController = class {
                testMethod(): any {}
            };

            // Create invalid descriptor (no value)
            const descriptor: PropertyDescriptor = {
                writable: true,
                enumerable: false,
                configurable: true,
            };

            const decorator = GrpcMethod();
            expect(() => {
                decorator(TestController.prototype, 'testMethod', descriptor);
            }).toThrow('@GrpcMethod can only be applied to methods');
        });

        it('should throw error for empty method name', () => {
            const TestController = class {
                testMethod(): any {}
            };

            const descriptor: PropertyDescriptor = {
                value: TestController.prototype.testMethod,
                writable: true,
                enumerable: false,
                configurable: true,
            };

            const decorator = GrpcMethod({ methodName: '' });
            expect(() => {
                decorator(TestController.prototype, 'testMethod', descriptor);
            }).toThrow('Method name cannot be empty');
        });
    });

    describe('GrpcStream', () => {
        it('should set streaming method metadata with default options', () => {
            const TestController = class {
                streamMethod(): any {}
            };

            const descriptor: PropertyDescriptor = {
                value: TestController.prototype.streamMethod,
                writable: true,
                enumerable: false,
                configurable: true,
            };

            const decorator = GrpcStream();
            decorator(TestController.prototype, 'streamMethod', descriptor);

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestController.prototype,
                'streamMethod',
            );
            expect(metadata).toEqual({ methodName: 'streamMethod', streaming: true });
        });

        it('should set streaming method metadata with string method name', () => {
            const TestController = class {
                streamMethod(): any {}
            };

            const descriptor: PropertyDescriptor = {
                value: TestController.prototype.streamMethod,
                writable: true,
                enumerable: false,
                configurable: true,
            };

            const decorator = GrpcStream('CustomStream');
            decorator(TestController.prototype, 'streamMethod', descriptor);

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestController.prototype,
                'streamMethod',
            );
            expect(metadata).toEqual({ methodName: 'CustomStream', streaming: true });
        });

        it('should set streaming method metadata with options object', () => {
            const options = {
                methodName: 'CustomStream',
                timeout: 10000,
            };

            const TestController = class {
                streamMethod(): any {}
            };

            const descriptor: PropertyDescriptor = {
                value: TestController.prototype.streamMethod,
                writable: true,
                enumerable: false,
                configurable: true,
            };

            const decorator = GrpcStream(options);
            decorator(TestController.prototype, 'streamMethod', descriptor);

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestController.prototype,
                'streamMethod',
            );
            expect(metadata).toEqual({ ...options, streaming: true });
        });

        it('should always set streaming to true', () => {
            const options = {
                methodName: 'CustomStream',
                streaming: false, // This should be overridden
            };

            const TestController = class {
                streamMethod(): any {}
            };

            const descriptor: PropertyDescriptor = {
                value: TestController.prototype.streamMethod,
                writable: true,
                enumerable: false,
                configurable: true,
            };

            const decorator = GrpcStream(options);
            decorator(TestController.prototype, 'streamMethod', descriptor);

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestController.prototype,
                'streamMethod',
            );
            expect(metadata.streaming).toBe(true);
        });

        it('should throw error when applied to non-method', () => {
            const TestController = class {
                streamMethod(): any {}
            };

            const descriptor: PropertyDescriptor = {
                writable: true,
                enumerable: false,
                configurable: true,
            };

            const decorator = GrpcStream();
            expect(() => {
                decorator(TestController.prototype, 'streamMethod', descriptor);
            }).toThrow('@GrpcStream can only be applied to methods');
        });

        it('should throw error for empty method name', () => {
            const TestController = class {
                streamMethod(): any {}
            };

            const descriptor: PropertyDescriptor = {
                value: TestController.prototype.streamMethod,
                writable: true,
                enumerable: false,
                configurable: true,
            };

            const decorator = GrpcStream({ methodName: '' });
            expect(() => {
                decorator(TestController.prototype, 'streamMethod', descriptor);
            }).toThrow('Method name cannot be empty');
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

        it('should throw error for invalid service name', () => {
            expect(() => {
                @GrpcService('')
                class TestServiceClient {}
            }).toThrow('Service name is required and must be a string');
        });

        it('should throw error for non-string service name', () => {
            expect(() => {
                @GrpcService(null as any)
                class TestServiceClient {}
            }).toThrow();
        });

        it('should throw error when applied to non-class', () => {
            const decorator = GrpcService('TestService');
            expect(() => {
                decorator(null as any);
            }).toThrow('@GrpcService can only be applied to classes');
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
            }).toThrow('Service name is required and must be a string for @InjectGrpcClient');
        });

        it('should throw error for non-string service name', () => {
            expect(() => {
                InjectGrpcClient(null as any);
            }).toThrow('Service name is required and must be a string for @InjectGrpcClient');
        });

        it('should throw error for whitespace only service name', () => {
            expect(() => {
                InjectGrpcClient('   ');
            }).toThrow('Service name cannot be empty for @InjectGrpcClient');
        });
    });
});
