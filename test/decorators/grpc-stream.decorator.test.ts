import { GRPC_METHOD_METADATA } from '../../src/constants';
import { GrpcStream } from '../../src/decorators/grpc-stream.decorator';

describe('GrpcStream decorator', () => {
    it('sets metadata with inferred method name when no args provided', () => {
        class TestController {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            streamMethod(): any {}
        }

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

    it('sets metadata with provided string method name', () => {
        class TestController {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            streamMethod(): any {}
        }

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

    it('throws when applied to non-method', () => {
        class TestController {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            streamMethod(): any {}
        }

        const descriptor: PropertyDescriptor = {
            writable: true,
            enumerable: false,
            configurable: true,
        };

        const decorator = GrpcStream();
        expect(() => decorator(TestController.prototype, 'streamMethod', descriptor)).toThrow(
            '@GrpcStream can only be applied to methods',
        );
    });

    it('throws for empty method name', () => {
        class TestController {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            streamMethod(): any {}
        }

        const descriptor: PropertyDescriptor = {
            value: TestController.prototype.streamMethod,
            writable: true,
            enumerable: false,
            configurable: true,
        };

        const decorator = GrpcStream({ methodName: '' });
        expect(() => decorator(TestController.prototype, 'streamMethod', descriptor)).toThrow(
            'Method name cannot be empty',
        );
    });
});

