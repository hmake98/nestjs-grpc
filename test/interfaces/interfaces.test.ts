import {
    GrpcLoggingOptions,
    GrpcOptions,
    GrpcClientOptions,
    GrpcModuleAsyncOptions,
    GrpcOptionsFactory,
    GrpcFeatureOptions,
    GrpcControllerOptions,
    GrpcServiceOptions,
    GrpcMethodOptions,
    GrpcExceptionOptions,
    ControllerMetadata,
    ServiceClientMetadata,
    GenerateCommandOptions,
} from '../../src/interfaces';
import { GrpcErrorCode } from '../../src/constants';

describe('Interfaces', () => {
    describe('GrpcLoggingOptions', () => {
        it('should allow all logging options', () => {
            const loggingOptions: GrpcLoggingOptions = {
                enabled: true,
                level: 'debug',
                context: 'TestContext',
                logErrors: true,
                logPerformance: true,
                logDetails: true,
            };

            expect(loggingOptions.enabled).toBe(true);
            expect(loggingOptions.level).toBe('debug');
            expect(loggingOptions.context).toBe('TestContext');
            expect(loggingOptions.logErrors).toBe(true);
            expect(loggingOptions.logPerformance).toBe(true);
            expect(loggingOptions.logDetails).toBe(true);
        });

        it('should work with minimal options', () => {
            const loggingOptions: GrpcLoggingOptions = {};

            expect(loggingOptions).toBeDefined();
        });

        it('should support all log levels', () => {
            const levels: GrpcLoggingOptions['level'][] = [
                'debug',
                'verbose',
                'log',
                'warn',
                'error',
            ];

            levels.forEach(level => {
                const options: GrpcLoggingOptions = { level };
                expect(options.level).toBe(level);
            });
        });
    });

    describe('GrpcOptions', () => {
        it('should require protoPath and package', () => {
            const options: GrpcOptions = {
                protoPath: '/path/to/proto',
                package: 'test.package',
            };

            expect(options.protoPath).toBe('/path/to/proto');
            expect(options.package).toBe('test.package');
        });

        it('should allow all optional properties', () => {
            const options: GrpcOptions = {
                protoPath: '/path/to/proto',
                package: 'test.package',
                url: 'localhost:5000',
                loaderOptions: {
                    keepCase: true,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true,
                },
                maxSendMessageSize: 1024,
                maxReceiveMessageSize: 2048,
                logging: {
                    enabled: true,
                    level: 'debug',
                },
            };

            expect(options.url).toBe('localhost:5000');
            expect(options.loaderOptions).toBeDefined();
            expect(options.maxSendMessageSize).toBe(1024);
            expect(options.maxReceiveMessageSize).toBe(2048);
            expect(options.logging).toBeDefined();
        });
    });

    describe('GrpcClientOptions', () => {
        it('should work with minimal configuration', () => {
            const options: GrpcClientOptions = {
                service: 'TestService',
            };

            expect(options.service).toBe('TestService');
        });

        it('should allow all optional properties', () => {
            const options: GrpcClientOptions = {
                service: 'TestService',
                package: 'test.package',
                url: 'localhost:5000',
                timeout: 30000,
                maxRetries: 3,
                retryDelay: 1000,
                secure: true,
                channelOptions: {
                    'grpc.max_receive_message_length': 1024,
                },
            };

            expect(options.package).toBe('test.package');
            expect(options.url).toBe('localhost:5000');
            expect(options.timeout).toBe(30000);
            expect(options.maxRetries).toBe(3);
            expect(options.retryDelay).toBe(1000);
            expect(options.secure).toBe(true);
            expect(options.channelOptions).toBeDefined();
        });
    });

    describe('GrpcModuleAsyncOptions', () => {
        it('should support useFactory', () => {
            const options: GrpcModuleAsyncOptions = {
                useFactory: () => ({
                    protoPath: '/path/to/proto',
                    package: 'test.package',
                }),
                inject: ['CONFIG_SERVICE'],
                imports: [],
            };

            expect(options.useFactory).toBeDefined();
            expect(options.inject).toEqual(['CONFIG_SERVICE']);
            expect(options.imports).toEqual([]);
        });

        it('should support useClass', () => {
            class ConfigService implements GrpcOptionsFactory {
                createGrpcOptions() {
                    return {
                        protoPath: '/path/to/proto',
                        package: 'test.package',
                    };
                }
            }

            const options: GrpcModuleAsyncOptions = {
                useClass: ConfigService,
            };

            expect(options.useClass).toBe(ConfigService);
        });

        it('should support useExisting', () => {
            class ConfigService implements GrpcOptionsFactory {
                createGrpcOptions() {
                    return {
                        protoPath: '/path/to/proto',
                        package: 'test.package',
                    };
                }
            }

            const options: GrpcModuleAsyncOptions = {
                useExisting: ConfigService,
            };

            expect(options.useExisting).toBe(ConfigService);
        });
    });

    describe('GrpcOptionsFactory', () => {
        it('should define createGrpcOptions method', () => {
            class TestFactory implements GrpcOptionsFactory {
                createGrpcOptions() {
                    return {
                        protoPath: '/path/to/proto',
                        package: 'test.package',
                    };
                }
            }

            const factory = new TestFactory();
            const options = factory.createGrpcOptions();

            expect(options.protoPath).toBe('/path/to/proto');
            expect(options.package).toBe('test.package');
        });

        it('should support async createGrpcOptions', async () => {
            class AsyncFactory implements GrpcOptionsFactory {
                async createGrpcOptions() {
                    return Promise.resolve({
                        protoPath: '/path/to/proto',
                        package: 'test.package',
                    });
                }
            }

            const factory = new AsyncFactory();
            const options = await factory.createGrpcOptions();

            expect(options.protoPath).toBe('/path/to/proto');
            expect(options.package).toBe('test.package');
        });
    });

    describe('GrpcFeatureOptions', () => {
        it('should allow empty options', () => {
            const options: GrpcFeatureOptions = {};

            expect(options).toBeDefined();
        });

        it('should allow controllers and services', () => {
            class TestController {}
            class TestService {}

            const options: GrpcFeatureOptions = {
                controllers: [TestController],
                services: [TestService],
            };

            expect(options.controllers).toEqual([TestController]);
            expect(options.services).toEqual([TestService]);
        });
    });

    describe('GrpcControllerOptions', () => {
        it('should work with minimal configuration', () => {
            const options: GrpcControllerOptions = {
                serviceName: 'TestService',
            };

            expect(options.serviceName).toBe('TestService');
        });

        it('should allow all optional properties', () => {
            const options: GrpcControllerOptions = {
                serviceName: 'TestService',
                package: 'test.package',
                url: 'localhost:5000',
            };

            expect(options.package).toBe('test.package');
            expect(options.url).toBe('localhost:5000');
        });
    });

    describe('GrpcServiceOptions', () => {
        it('should work with minimal configuration', () => {
            const options: GrpcServiceOptions = {
                serviceName: 'TestService',
            };

            expect(options.serviceName).toBe('TestService');
        });

        it('should allow all optional properties', () => {
            const options: GrpcServiceOptions = {
                serviceName: 'TestService',
                package: 'test.package',
                url: 'localhost:5000',
                clientOptions: {
                    timeout: 30000,
                },
            };

            expect(options.package).toBe('test.package');
            expect(options.url).toBe('localhost:5000');
            expect(options.clientOptions?.timeout).toBe(30000);
        });
    });

    describe('GrpcMethodOptions', () => {
        it('should work with minimal configuration', () => {
            const options: GrpcMethodOptions = {};

            expect(options).toBeDefined();
        });

        it('should allow timeout', () => {
            const options: GrpcMethodOptions = {
                timeout: 30000,
            };

            expect(options.timeout).toBe(30000);
        });
    });

    describe('GrpcExceptionOptions', () => {
        it('should require code and message', () => {
            const options: GrpcExceptionOptions = {
                code: GrpcErrorCode.NOT_FOUND,
                message: 'Resource not found',
            };

            expect(options.code).toBe(GrpcErrorCode.NOT_FOUND);
            expect(options.message).toBe('Resource not found');
        });

        it('should allow all optional properties', () => {
            const options: GrpcExceptionOptions = {
                code: GrpcErrorCode.INVALID_ARGUMENT,
                message: 'Invalid input',
                details: { field: 'email', error: 'invalid format' },
                metadata: { 'trace-id': '123' },
            };

            expect(options.details).toEqual({ field: 'email', error: 'invalid format' });
            expect(options.metadata).toEqual({ 'trace-id': '123' });
        });
    });

    describe('ControllerMetadata', () => {
        it('should define controller metadata structure', () => {
            const metadata: ControllerMetadata = {
                serviceName: 'TestService',
                package: 'test.package',
                url: 'localhost:5000',
                methods: new Map(),
            };

            expect(metadata.serviceName).toBe('TestService');
            expect(metadata.package).toBe('test.package');
            expect(metadata.url).toBe('localhost:5000');
            expect(metadata.methods).toBeInstanceOf(Map);
        });

        it('should work with minimal configuration', () => {
            const metadata: ControllerMetadata = {
                serviceName: 'TestService',
                methods: new Map(),
            };

            expect(metadata.serviceName).toBe('TestService');
            expect(metadata.methods).toBeInstanceOf(Map);
        });
    });

    describe('ServiceClientMetadata', () => {
        it('should define service client metadata structure', () => {
            const metadata: ServiceClientMetadata = {
                serviceName: 'TestService',
                package: 'test.package',
                url: 'localhost:5000',
                clientOptions: {
                    service: 'TestService',
                },
            };

            expect(metadata.serviceName).toBe('TestService');
            expect(metadata.package).toBe('test.package');
            expect(metadata.url).toBe('localhost:5000');
            expect(metadata.clientOptions).toBeDefined();
        });

        it('should allow optional properties', () => {
            const metadata: ServiceClientMetadata = {
                serviceName: 'TestService',
            };

            expect(metadata.package).toBeUndefined();
            expect(metadata.url).toBeUndefined();
            expect(metadata.clientOptions).toBeUndefined();
        });
    });

    describe('GenerateCommandOptions', () => {
        it('should define generate command options', () => {
            const options: GenerateCommandOptions = {
                proto: './proto/service.proto',
                output: './generated',
                watch: false,
                recursive: true,
                classes: false,
                comments: true,
                packageFilter: 'test.package',
                verbose: true,
                silent: false,
            };

            expect(options.proto).toBe('./proto/service.proto');
            expect(options.output).toBe('./generated');
            expect(options.watch).toBe(false);
            expect(options.recursive).toBe(true);
            expect(options.classes).toBe(false);
            expect(options.comments).toBe(true);
            expect(options.packageFilter).toBe('test.package');
            expect(options.verbose).toBe(true);
            expect(options.silent).toBe(false);
        });

        it('should work with minimal configuration', () => {
            const options: GenerateCommandOptions = {
                proto: './proto/service.proto',
                output: './generated',
                watch: false,
            };

            expect(options.proto).toBe('./proto/service.proto');
            expect(options.output).toBe('./generated');
            expect(options.watch).toBe(false);
        });
    });
});
