import { GrpcStream } from '../../src/decorators/grpc-stream.decorator';
import { GRPC_METHOD_METADATA } from '../../src/constants';
import { GrpcMethodOptions } from '../../src/interfaces';

describe('GrpcStream Decorator', () => {
    class TestController {
        testMethod() {
            return 'test';
        }

        anotherMethod() {
            return 'another';
        }

        emptyNameMethod() {
            return 'empty';
        }
    }

    let testController: TestController;

    beforeEach(() => {
        testController = new TestController();
        // Clear any existing metadata
        Reflect.deleteMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
        Reflect.deleteMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'anotherMethod');
        Reflect.deleteMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'emptyNameMethod');
    });

    describe('basic functionality', () => {
        it('should be defined', () => {
            expect(GrpcStream).toBeDefined();
            expect(typeof GrpcStream).toBe('function');
        });

        it('should apply metadata to method with string parameter', () => {
            const decorator = GrpcStream('TestStreamMethod');
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            const result = decorator(TestController.prototype, 'testMethod', descriptor);

            expect(result).toBe(descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('TestStreamMethod');
            expect(metadata.streaming).toBe(true);
        });

        it('should apply metadata to method with options object', () => {
            const options: GrpcMethodOptions = {
                methodName: 'CustomStreamMethod',
                timeout: 30000,
            };
            const decorator = GrpcStream(options);
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            const result = decorator(TestController.prototype, 'testMethod', descriptor);

            expect(result).toBe(descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('CustomStreamMethod');
            expect(metadata.timeout).toBe(30000);
            expect(metadata.streaming).toBe(true);
        });

        it('should use method name when no parameter provided', () => {
            const decorator = GrpcStream();
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('testMethod');
            expect(metadata.streaming).toBe(true);
        });

        it('should use method name when empty options object provided', () => {
            const decorator = GrpcStream({});
            const descriptor = {
                value: testController.anotherMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, 'anotherMethod', descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'anotherMethod');
            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('anotherMethod');
            expect(metadata.streaming).toBe(true);
        });
    });

    describe('parameter handling', () => {
        it('should handle string parameter', () => {
            const decorator = GrpcStream('GetDataStream');
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(metadata.methodName).toBe('GetDataStream');
        });

        it('should handle options object with only methodName', () => {
            const options: GrpcMethodOptions = { methodName: 'StreamData' };
            const decorator = GrpcStream(options);
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(metadata.methodName).toBe('StreamData');
            expect(metadata.streaming).toBe(true);
        });

        it('should handle options object with timeout', () => {
            const options: GrpcMethodOptions = {
                methodName: 'TimedStream',
                timeout: 60000,
            };
            const decorator = GrpcStream(options);
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(metadata.methodName).toBe('TimedStream');
            expect(metadata.timeout).toBe(60000);
            expect(metadata.streaming).toBe(true);
        });

        it('should preserve existing options and add streaming flag', () => {
            const options: GrpcMethodOptions = {
                methodName: 'ComplexStream',
                timeout: 45000,
            };
            const decorator = GrpcStream(options);
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(metadata.methodName).toBe('ComplexStream');
            expect(metadata.timeout).toBe(45000);
            expect(metadata.streaming).toBe(true);
        });

        it('should handle undefined parameter', () => {
            const decorator = GrpcStream(undefined);
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(metadata.methodName).toBe('testMethod');
            expect(metadata.streaming).toBe(true);
        });
    });

    describe('streaming flag', () => {
        it('should always set streaming to true', () => {
            const testCases = [
                GrpcStream('StreamMethod'),
                GrpcStream({ methodName: 'AnotherStream' }),
                GrpcStream(),
                GrpcStream({}),
            ];

            testCases.forEach((decorator, index) => {
                const methodName = `method${index}`;
                const descriptor = {
                    value: () => 'test',
                    writable: true,
                    enumerable: true,
                    configurable: true,
                };

                decorator(TestController.prototype, methodName, descriptor);

                const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, methodName);
                expect(metadata.streaming).toBe(true);
            });
        });

        it('should override streaming flag if provided in options', () => {
            const options: GrpcMethodOptions = {
                methodName: 'TestStream',
                streaming: false, // This should be overridden
            };
            const decorator = GrpcStream(options);
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(metadata.streaming).toBe(true); // Should be true despite being false in options
        });
    });

    describe('error handling', () => {
        it('should throw error when applied to non-method', () => {
            const decorator = GrpcStream('TestStream');
            const invalidDescriptor = {
                value: 'not a function',
                writable: true,
                enumerable: true,
                configurable: true,
            };

            expect(() => {
                decorator(TestController.prototype, 'testMethod', invalidDescriptor as any);
            }).toThrow('@GrpcStream can only be applied to methods');
        });

        it('should throw error when descriptor is null', () => {
            const decorator = GrpcStream('TestStream');

            expect(() => {
                decorator(TestController.prototype, 'testMethod', null as any);
            }).toThrow('@GrpcStream can only be applied to methods');
        });

        it('should throw error when descriptor is undefined', () => {
            const decorator = GrpcStream('TestStream');

            expect(() => {
                decorator(TestController.prototype, 'testMethod', undefined as any);
            }).toThrow('@GrpcStream can only be applied to methods');
        });

        it('should throw error when descriptor has no value', () => {
            const decorator = GrpcStream('TestStream');
            const invalidDescriptor = {
                writable: true,
                enumerable: true,
                configurable: true,
            };

            expect(() => {
                decorator(TestController.prototype, 'testMethod', invalidDescriptor as any);
            }).toThrow('@GrpcStream can only be applied to methods');
        });

        it('should throw error for empty method name string', () => {
            const decorator = GrpcStream('');

            expect(() => {
                decorator(TestController.prototype, 'emptyNameMethod', {
                    value: testController.emptyNameMethod,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
            }).toThrow('Method name cannot be empty');
        });

        it('should throw error for whitespace-only method name', () => {
            const decorator = GrpcStream('   ');

            expect(() => {
                decorator(TestController.prototype, 'emptyNameMethod', {
                    value: testController.emptyNameMethod,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
            }).toThrow('Method name cannot be empty');
        });

        it('should throw error for empty method name in options', () => {
            const options: GrpcMethodOptions = { methodName: '' };
            const decorator = GrpcStream(options);

            expect(() => {
                decorator(TestController.prototype, 'emptyNameMethod', {
                    value: testController.emptyNameMethod,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
            }).toThrow('Method name cannot be empty');
        });
    });

    describe('symbol keys', () => {
        it('should handle symbol keys for method names', () => {
            const symbolKey = Symbol('testSymbol');
            const decorator = GrpcStream('SymbolStream');
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, symbolKey, descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, symbolKey);
            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('SymbolStream');
            expect(metadata.streaming).toBe(true);
        });

        it('should use symbol description when no method name provided', () => {
            const symbolKey = Symbol('symbolMethod');
            const decorator = GrpcStream();
            const descriptor = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator(TestController.prototype, symbolKey, descriptor);

            const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, symbolKey);
            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('Symbol(symbolMethod)');
            expect(metadata.streaming).toBe(true);
        });
    });

    describe('metadata application', () => {
        it('should apply metadata to the correct method', () => {
            const decorator1 = GrpcStream('Stream1');
            const decorator2 = GrpcStream('Stream2');

            const descriptor1 = {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            const descriptor2 = {
                value: testController.anotherMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            };

            decorator1(TestController.prototype, 'testMethod', descriptor1);
            decorator2(TestController.prototype, 'anotherMethod', descriptor2);

            const metadata1 = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            const metadata2 = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'anotherMethod');

            expect(metadata1.methodName).toBe('Stream1');
            expect(metadata2.methodName).toBe('Stream2');
            expect(metadata1.streaming).toBe(true);
            expect(metadata2.streaming).toBe(true);
        });

        it('should not interfere with other method metadata', () => {
            // Apply stream decorator to one method
            const streamDecorator = GrpcStream('StreamMethod');
            streamDecorator(TestController.prototype, 'testMethod', {
                value: testController.testMethod,
                writable: true,
                enumerable: true,
                configurable: true,
            });

            // Check that other method has no metadata
            const otherMetadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'anotherMethod');
            expect(otherMetadata).toBeUndefined();

            // The decorated method should have metadata
            const streamMetadata = Reflect.getMetadata(GRPC_METHOD_METADATA, TestController.prototype, 'testMethod');
            expect(streamMetadata).toBeDefined();
            expect(streamMetadata.streaming).toBe(true);
        });
    });

    describe('real-world usage scenarios', () => {
        it('should work with typical streaming use cases', () => {
            class StreamController {
                @GrpcStream('GetDataStream')
                getDataStream() {
                    return 'streaming data';
                }

                @GrpcStream({ methodName: 'UploadFile', timeout: 300000 })
                uploadFile() {
                    return 'file upload stream';
                }

                @GrpcStream()
                bidirectionalChat() {
                    return 'chat stream';
                }
            }

            // Check GetDataStream
            const getDataMetadata = Reflect.getMetadata(GRPC_METHOD_METADATA, StreamController.prototype, 'getDataStream');
            expect(getDataMetadata.methodName).toBe('GetDataStream');
            expect(getDataMetadata.streaming).toBe(true);

            // Check UploadFile
            const uploadMetadata = Reflect.getMetadata(GRPC_METHOD_METADATA, StreamController.prototype, 'uploadFile');
            expect(uploadMetadata.methodName).toBe('UploadFile');
            expect(uploadMetadata.timeout).toBe(300000);
            expect(uploadMetadata.streaming).toBe(true);

            // Check bidirectionalChat
            const chatMetadata = Reflect.getMetadata(GRPC_METHOD_METADATA, StreamController.prototype, 'bidirectionalChat');
            expect(chatMetadata.methodName).toBe('bidirectionalChat');
            expect(chatMetadata.streaming).toBe(true);
        });
    });
});