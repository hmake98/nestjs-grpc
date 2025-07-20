import 'reflect-metadata';
import { GrpcController, GrpcMethod } from '../src/decorators';
import { GRPC_CONTROLLER_METADATA, GRPC_METHOD_METADATA } from '../src/constants';

@GrpcController('TestService')
class TestController {
    @GrpcMethod('TestMethod')
    async testMethod() {
        return { success: true };
    }

    @GrpcMethod()
    async anotherMethod() {
        return { data: 'test' };
    }
}

describe('Metadata Reflection', () => {
    it('should properly set and retrieve controller metadata', () => {
        const controllerMetadata = Reflect.getMetadata(GRPC_CONTROLLER_METADATA, TestController);
        expect(controllerMetadata).toBeDefined();
        expect(controllerMetadata.serviceName).toBe('TestService');
    });

    it('should properly set and retrieve method metadata', () => {
        const prototype = TestController.prototype;

        // Check first method
        const method1Metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, prototype, 'testMethod');
        expect(method1Metadata).toBeDefined();
        expect(method1Metadata.methodName).toBe('TestMethod');

        // Check second method
        const method2Metadata = Reflect.getMetadata(
            GRPC_METHOD_METADATA,
            prototype,
            'anotherMethod',
        );
        expect(method2Metadata).toBeDefined();
        expect(method2Metadata.methodName).toBe('anotherMethod');
    });

    it('should list all prototype methods', () => {
        const prototype = TestController.prototype;
        const methodNames = Object.getOwnPropertyNames(prototype).filter(
            name => name !== 'constructor' && typeof prototype[name] === 'function',
        );

        expect(methodNames).toContain('testMethod');
        expect(methodNames).toContain('anotherMethod');
    });
});
