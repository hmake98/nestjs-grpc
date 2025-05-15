import { GrpcMethod, GrpcMethodOptions } from '../../decorators/grpc-method.decorator';
import { GRPC_METHOD_METADATA } from '../../constants';

describe('GrpcMethod decorator', () => {
    describe('when used without arguments', () => {
        it('should set metadata with method name from key', () => {
            // Create a test class
            class TestService {
                @GrpcMethod()
                testMethod() {}
            }

            // Get the metadata from the method
            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestService.prototype,
                'testMethod',
            );

            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('testMethod');
        });
    });

    describe('when used with string argument', () => {
        it('should set metadata with specified method name', () => {
            class TestService {
                @GrpcMethod('CustomMethod')
                testMethod() {}
            }

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestService.prototype,
                'testMethod',
            );

            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('CustomMethod');
        });
    });

    describe('when used with options object', () => {
        it('should set metadata with options', () => {
            const options: GrpcMethodOptions = {
                methodName: 'CustomMethod',
                streaming: true,
            };

            class TestService {
                @GrpcMethod(options)
                testMethod() {}
            }

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestService.prototype,
                'testMethod',
            );

            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('CustomMethod');
            expect(metadata.streaming).toBe(true);
        });

        it('should use method name if methodName option not provided', () => {
            class TestService {
                @GrpcMethod({ streaming: true })
                testStreamingMethod() {}
            }

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestService.prototype,
                'testStreamingMethod',
            );

            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('testStreamingMethod');
            expect(metadata.streaming).toBe(true);
        });
    });

    describe('when used with symbol as key', () => {
        it('should convert symbol to string for method name', () => {
            const testSymbol = Symbol('test');

            class TestService {
                @GrpcMethod()
                [testSymbol]() {}
            }

            const metadata = Reflect.getMetadata(
                GRPC_METHOD_METADATA,
                TestService.prototype,
                testSymbol,
            );

            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('Symbol(test)');
        });
    });
});
