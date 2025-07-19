import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { Module, Controller } from '@nestjs/common';
import { GrpcModule, GrpcRegistryService } from '../src/grpc.module';
import { GrpcClientService } from '../src/services/grpc-client.service';
import { ProtoLoaderService } from '../src/services/proto-loader.service';
import { GrpcExceptionFilter } from '../src/exceptions/grpc.exception-filter';
import { GrpcOptionsFactory } from '../src/interfaces';
import { GRPC_OPTIONS, GRPC_CONTROLLER_METADATA, GRPC_SERVICE_METADATA, GRPC_METHOD_METADATA } from '../src/constants';
import { GrpcController } from '../src/decorators/grpc-controller.decorator';
import { GrpcService } from '../src/decorators/grpc-service.decorator';
import { GrpcMethod } from '../src/decorators/grpc-method.decorator';

describe('GrpcModule', () => {
    let module: TestingModule;

    const mockProtoLoaderService = {
        onModuleInit: jest.fn(),
        load: jest.fn(),
        getService: jest.fn(),
        getPackageDefinition: jest.fn(),
    };

    afterEach(async () => {
        if (module) {
            await module.close();
        }
    });

    describe('forRoot', () => {
        it('should create module with valid options', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module).toBeDefined();
            expect(module.get(GRPC_OPTIONS)).toEqual(options);
            expect(module.get(GrpcClientService)).toBeDefined();
            expect(module.get(ProtoLoaderService)).toBeDefined();
        });

        it('should throw error for invalid options', () => {
            expect(() => {
                GrpcModule.forRoot(null as any);
            }).toThrow('gRPC options must be a valid object');
        });

        it('should throw error for missing protoPath', () => {
            expect(() => {
                GrpcModule.forRoot({ package: 'test' } as any);
            }).toThrow('protoPath is required and must be a string');
        });

        it('should throw error for missing package', () => {
            expect(() => {
                GrpcModule.forRoot({ protoPath: 'test.proto' } as any);
            }).toThrow('package is required and must be a string');
        });

        it('should throw error for invalid url type', () => {
            expect(() => {
                GrpcModule.forRoot({
                    protoPath: 'test.proto',
                    package: 'test',
                    url: 123 as any,
                });
            }).toThrow('url must be a string');
        });

        it('should throw error for invalid maxSendMessageSize', () => {
            expect(() => {
                GrpcModule.forRoot({
                    protoPath: 'test.proto',
                    package: 'test',
                    maxSendMessageSize: -1,
                });
            }).toThrow('maxSendMessageSize must be a positive number');
        });

        it('should throw error for non-number maxSendMessageSize', () => {
            expect(() => {
                GrpcModule.forRoot({
                    protoPath: 'test.proto',
                    package: 'test',
                    maxSendMessageSize: 'invalid' as any,
                });
            }).toThrow('maxSendMessageSize must be a positive number');
        });

        it('should throw error for invalid maxReceiveMessageSize', () => {
            expect(() => {
                GrpcModule.forRoot({
                    protoPath: 'test.proto',
                    package: 'test',
                    maxReceiveMessageSize: 0,
                });
            }).toThrow('maxReceiveMessageSize must be a positive number');
        });

        it('should throw error for non-number maxReceiveMessageSize', () => {
            expect(() => {
                GrpcModule.forRoot({
                    protoPath: 'test.proto',
                    package: 'test',
                    maxReceiveMessageSize: 'invalid' as any,
                });
            }).toThrow('maxReceiveMessageSize must be a positive number');
        });

        it('should create module with default options', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            const grpcOptions = module.get(GRPC_OPTIONS);
            expect(grpcOptions.protoPath).toBe(options.protoPath);
            expect(grpcOptions.package).toBe(options.package);
            expect(grpcOptions.url).toBeUndefined();
        });
    });

    describe('forRootAsync', () => {
        it('should create module with factory', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forRootAsync({
                        useFactory: () => options,
                    }),
                ],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module).toBeDefined();
            expect(module.get(GRPC_OPTIONS)).toEqual({
                ...options,
            });
        });

        it('should create module with factory and inject dependencies', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            const mockService = { getConfig: () => options };

            module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forRootAsync({
                        useFactory: (configService: any) => configService.getConfig(),
                        inject: ['CONFIG_SERVICE'],
                        providers: [
                            { provide: 'CONFIG_SERVICE', useValue: mockService }
                        ]
                    }),
                ],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module).toBeDefined();
            expect(module.get(GRPC_OPTIONS)).toEqual({
                ...options,
            });
        });

        it('should create module with useClass', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            class TestConfigService implements GrpcOptionsFactory {
                createGrpcOptions() {
                    return options;
                }
            }

            module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forRootAsync({
                        useClass: TestConfigService,
                    }),
                ],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module).toBeDefined();
            expect(module.get(GRPC_OPTIONS)).toEqual({
                ...options,
            });
        });

        it('should create module with useExisting', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            class TestConfigService implements GrpcOptionsFactory {
                createGrpcOptions() {
                    return options;
                }
            }

            module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forRootAsync({
                        useExisting: TestConfigService,
                        providers: [TestConfigService],
                    }),
                ],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module).toBeDefined();
            expect(module.get(GRPC_OPTIONS)).toEqual({
                ...options,
            });
        });

        it('should throw error for invalid async options', async () => {
            await expect(
                Test.createTestingModule({
                    imports: [
                        GrpcModule.forRootAsync({
                            useFactory: () => Promise.resolve(null as any),
                        }),
                    ],
                })
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile(),
            ).rejects.toThrow('gRPC options must be a valid object');
        });

        it('should throw error for null async options', () => {
            expect(() => {
                GrpcModule.forRootAsync(null as any);
            }).toThrow('Async options must be a valid object');
        });

        it('should throw error when no async provider is specified', () => {
            expect(() => {
                GrpcModule.forRootAsync({} as any);
            }).toThrow('One of useFactory, useClass, or useExisting must be provided');
        });

        it('should handle factory validation error', async () => {
            await expect(
                Test.createTestingModule({
                    imports: [
                        GrpcModule.forRootAsync({
                            useFactory: () => ({ invalid: 'options' } as any),
                        }),
                    ],
                })
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile(),
            ).rejects.toThrow('protoPath is required and must be a string');
        });

        it('should handle useClass validation error', async () => {
            class InvalidConfigService implements GrpcOptionsFactory {
                createGrpcOptions() {
                    return { invalid: 'options' } as any;
                }
            }

            await expect(
                Test.createTestingModule({
                    imports: [
                        GrpcModule.forRootAsync({
                            useClass: InvalidConfigService,
                        }),
                    ],
                })
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile(),
            ).rejects.toThrow('protoPath is required and must be a string');
        });
    });

    describe('forFeature', () => {
        it('should create feature module', async () => {
            const baseOptions = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            class TestController {}
            class TestService {}

            const featureOptions = {
                controllers: [TestController],
                services: [TestService],
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(baseOptions), GrpcModule.forFeature(featureOptions)],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module).toBeDefined();
        });

        it('should create feature module with empty options', async () => {
            const baseOptions = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(baseOptions), GrpcModule.forFeature()],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module).toBeDefined();
        });

        it('should handle feature module with only controllers', async () => {
            const baseOptions = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            class TestController {}

            module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forRoot(baseOptions),
                    GrpcModule.forFeature({
                        controllers: [TestController],
                    }),
                ],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module).toBeDefined();
        });

        it('should handle feature module with only services', async () => {
            const baseOptions = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            class TestService {}

            module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forRoot(baseOptions),
                    GrpcModule.forFeature({
                        services: [TestService],
                    }),
                ],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module).toBeDefined();
        });
    });

    describe('providers', () => {
        it('should provide all required services', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            expect(module.get(GrpcClientService)).toBeDefined();
            expect(module.get(ProtoLoaderService)).toBeDefined();
            // GrpcExceptionFilter is provided as APP_FILTER, not as a regular provider
            // so we can't test it directly like this
        });

        it('should be global module', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            const grpcModule = GrpcModule.forRoot(options);
            expect(grpcModule.global).toBe(true);
        });
    });

    describe('validation', () => {
        it('should validate loader options', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
                loaderOptions: {
                    keepCase: true,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true,
                },
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            const grpcOptions = module.get(GRPC_OPTIONS);
            expect(grpcOptions.loaderOptions).toEqual(options.loaderOptions);
        });

        it('should validate channel options', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
                channelOptions: {
                    'grpc.max_receive_message_length': 1024 * 1024,
                    'grpc.max_send_message_length': 1024 * 1024,
                },
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            const grpcOptions = module.get(GRPC_OPTIONS);
            expect(grpcOptions.channelOptions).toEqual(options.channelOptions);
        });

        it('should validate credentials options', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
                credentials: {
                    secure: true,
                    rootCerts: Buffer.from('root-cert'),
                },
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            const grpcOptions = module.get(GRPC_OPTIONS);
            expect(grpcOptions.credentials).toEqual(options.credentials);
        });

        it('should validate logging options', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
                logging: {
                    level: 'debug' as const,
                    debug: true,
                    context: 'TestContext',
                },
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            const grpcOptions = module.get(GRPC_OPTIONS);
            expect(grpcOptions.logging).toEqual(options.logging);
        });
    });

    describe('GrpcRegistryService', () => {
        let registryService: GrpcRegistryService;
        let discoveryService: DiscoveryService;

        beforeEach(async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
                logging: { level: 'debug' as const },
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            })
            .overrideProvider(ProtoLoaderService)
            .useValue(mockProtoLoaderService)
            .compile();

            registryService = module.get(GrpcRegistryService);
            discoveryService = module.get(DiscoveryService);
        });

        it('should be defined', () => {
            expect(registryService).toBeDefined();
        });

        it('should initialize with empty maps', () => {
            expect(registryService.getControllers().size).toBe(0);
            expect(registryService.getServiceClients().size).toBe(0);
        });

        it('should return undefined for non-existent controller', () => {
            expect(registryService.getController('nonexistent')).toBeUndefined();
        });

        it('should return undefined for non-existent service client', () => {
            expect(registryService.getServiceClient('nonexistent')).toBeUndefined();
        });

        describe('controller discovery', () => {
            @GrpcController({
                serviceName: 'TestService',
                package: 'test',
            })
            class TestController {
                @GrpcMethod()
                testMethod() {
                    return {};
                }
            }

            @GrpcController({
                serviceName: 'AnotherService',
                package: 'test',
            })
            class AnotherController {
                @GrpcMethod()
                anotherMethod() {
                    return {};
                }

                normalMethod() {
                    return {};
                }
            }

            class InvalidController {}

            beforeEach(async () => {
                const options = {
                    protoPath: '/test/path.proto',
                    package: 'test.package',
                    logging: { level: 'debug' as const },
                };

                module = await Test.createTestingModule({
                    imports: [GrpcModule.forRoot(options)],
                    controllers: [TestController, AnotherController, InvalidController],
                })
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile();

                registryService = module.get(GrpcRegistryService);
                await module.init();
            });

            it('should discover gRPC controllers', () => {
                const controllers = registryService.getControllers();
                expect(controllers.size).toBe(2);
                expect(controllers.has('TestService')).toBe(true);
                expect(controllers.has('AnotherService')).toBe(true);
            });

            it('should extract controller metadata correctly', () => {
                const controller = registryService.getController('TestService');
                expect(controller).toBeDefined();
                expect(controller!.serviceName).toBe('TestService');
                expect(controller!.package).toBe('test');
                expect(controller!.methods.size).toBe(1);
                expect(controller!.methods.has('testMethod')).toBe(true);
            });

            it('should only include methods with gRPC metadata', () => {
                const controller = registryService.getController('AnotherService');
                expect(controller).toBeDefined();
                expect(controller!.methods.size).toBe(1);
                expect(controller!.methods.has('anotherMethod')).toBe(true);
                expect(controller!.methods.has('normalMethod')).toBe(false);
            });

            it('should not register duplicate controllers', async () => {
                @GrpcController({
                    serviceName: 'TestService',
                    package: 'test',
                })
                class DuplicateController {}

                const duplicateModule = await Test.createTestingModule({
                    imports: [GrpcModule.forRoot({
                        protoPath: '/test/path.proto',
                        package: 'test.package',
                    })],
                    controllers: [TestController, DuplicateController],
                })
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile();

                const duplicateRegistry = duplicateModule.get(GrpcRegistryService);
                await duplicateModule.init();

                const controllers = duplicateRegistry.getControllers();
                expect(controllers.size).toBe(1);

                await duplicateModule.close();
            });
        });

        describe('service client discovery', () => {
            @GrpcService({
                serviceName: 'ClientService',
                package: 'test',
            })
            class TestServiceClient {}

            @GrpcService({
                serviceName: 'AnotherClientService',
                package: 'test',
            })
            class AnotherServiceClient {}

            class InvalidServiceClient {}

            beforeEach(async () => {
                const options = {
                    protoPath: '/test/path.proto',
                    package: 'test.package',
                    logging: { level: 'debug' as const },
                };

                module = await Test.createTestingModule({
                    imports: [GrpcModule.forRoot(options)],
                    providers: [TestServiceClient, AnotherServiceClient, InvalidServiceClient],
                })
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile();

                registryService = module.get(GrpcRegistryService);
                await module.init();
            });

            it('should discover gRPC service clients', () => {
                const serviceClients = registryService.getServiceClients();
                expect(serviceClients.size).toBe(2);
                expect(serviceClients.has('ClientService')).toBe(true);
                expect(serviceClients.has('AnotherClientService')).toBe(true);
            });

            it('should get specific service client', () => {
                const serviceClient = registryService.getServiceClient('ClientService');
                expect(serviceClient).toBeDefined();
                expect(serviceClient!.serviceName).toBe('ClientService');
                expect(serviceClient!.package).toBe('test');
            });

            it('should not register duplicate service clients', async () => {
                @GrpcService({
                    serviceName: 'ClientService',
                    package: 'test',
                })
                class DuplicateServiceClient {}

                const duplicateModule = await Test.createTestingModule({
                    imports: [GrpcModule.forRoot({
                        protoPath: '/test/path.proto',
                        package: 'test.package',
                    })],
                    providers: [TestServiceClient, DuplicateServiceClient],
                })
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile();

                const duplicateRegistry = duplicateModule.get(GrpcRegistryService);
                await duplicateModule.init();

                const serviceClients = duplicateRegistry.getServiceClients();
                expect(serviceClients.size).toBe(1);

                await duplicateModule.close();
            });
        });

        describe('error handling', () => {
            it('should handle controller without metadata gracefully', async () => {
                class BadController {}

                // Mock discoveryService to return a controller without metadata
                const mockDiscoveryService = {
                    getControllers: jest.fn().mockReturnValue([{
                        metatype: BadController,
                        name: 'BadController'
                    }]),
                    getProviders: jest.fn().mockReturnValue([])
                };

                const testModule = await Test.createTestingModule({
                    imports: [GrpcModule.forRoot({
                        protoPath: '/test/path.proto',
                        package: 'test.package',
                    })],
                })
                .overrideProvider(DiscoveryService)
                .useValue(mockDiscoveryService)
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile();

                const testRegistry = testModule.get(GrpcRegistryService);
                await testModule.init();

                expect(testRegistry.getControllers().size).toBe(0);
                await testModule.close();
            });

            it('should handle service without metadata gracefully', async () => {
                class BadService {}

                // Mock discoveryService to return a service without metadata
                const mockDiscoveryService = {
                    getControllers: jest.fn().mockReturnValue([]),
                    getProviders: jest.fn().mockReturnValue([{
                        metatype: BadService,
                        name: 'BadService'
                    }])
                };

                const testModule = await Test.createTestingModule({
                    imports: [GrpcModule.forRoot({
                        protoPath: '/test/path.proto',
                        package: 'test.package',
                    })],
                })
                .overrideProvider(DiscoveryService)
                .useValue(mockDiscoveryService)
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile();

                const testRegistry = testModule.get(GrpcRegistryService);
                await testModule.init();

                expect(testRegistry.getServiceClients().size).toBe(0);
                await testModule.close();
            });

            it('should handle controller registration errors', async () => {
                @GrpcController({
                    serviceName: 'ErrorService',
                    package: 'test',
                })
                class ErrorController {}

                // Mock Reflect.getMetadata to throw an error during metadata extraction
                const originalGetMetadata = Reflect.getMetadata;
                const mockGetMetadata = jest.fn((metadataKey: any, target: any, propertyKey?: any) => {
                    if (metadataKey === GRPC_CONTROLLER_METADATA && target === ErrorController) {
                        throw new Error('Metadata extraction failed');
                    }
                    return originalGetMetadata(metadataKey, target, propertyKey);
                });
                Reflect.getMetadata = mockGetMetadata;

                const mockDiscoveryService = {
                    getControllers: jest.fn().mockReturnValue([{
                        metatype: ErrorController,
                        name: 'ErrorController'
                    }]),
                    getProviders: jest.fn().mockReturnValue([])
                };

                const testModule = await Test.createTestingModule({
                    imports: [GrpcModule.forRoot({
                        protoPath: '/test/path.proto',
                        package: 'test.package',
                    })],
                })
                .overrideProvider(DiscoveryService)
                .useValue(mockDiscoveryService)
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile();

                const testRegistry = testModule.get(GrpcRegistryService);
                await testModule.init();

                expect(testRegistry.getControllers().size).toBe(0);
                
                // Restore original function
                Reflect.getMetadata = originalGetMetadata;
                await testModule.close();
            });

            it('should handle service with null metadata', async () => {
                @GrpcService({
                    serviceName: 'NullService',
                    package: 'test',
                })
                class NullService {}

                // Mock Reflect.getMetadata to return null for service metadata
                const originalGetMetadata = Reflect.getMetadata;
                const mockGetMetadata = jest.fn((metadataKey: any, target: any) => {
                    if (metadataKey === GRPC_SERVICE_METADATA && target === NullService) {
                        return null;
                    }
                    return originalGetMetadata(metadataKey, target);
                });
                Reflect.getMetadata = mockGetMetadata;

                const mockDiscoveryService = {
                    getControllers: jest.fn().mockReturnValue([]),
                    getProviders: jest.fn().mockReturnValue([{
                        metatype: NullService,
                        name: 'NullService'
                    }])
                };

                const testModule = await Test.createTestingModule({
                    imports: [GrpcModule.forRoot({
                        protoPath: '/test/path.proto',
                        package: 'test.package',
                    })],
                })
                .overrideProvider(DiscoveryService)
                .useValue(mockDiscoveryService)
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile();

                const testRegistry = testModule.get(GrpcRegistryService);
                await testModule.init();

                expect(testRegistry.getServiceClients().size).toBe(0);
                
                // Restore original function
                Reflect.getMetadata = originalGetMetadata;
                await testModule.close();
            });

            it('should handle service registration errors', async () => {
                @GrpcService({
                    serviceName: 'ErrorService',
                    package: 'test',
                })
                class ErrorService {}

                // Mock Reflect.getMetadata to throw an error for service metadata
                const originalGetMetadata = Reflect.getMetadata;
                const mockGetMetadata = jest.fn((metadataKey: any, target: any) => {
                    if (metadataKey === GRPC_SERVICE_METADATA && target === ErrorService) {
                        throw new Error('Service metadata extraction failed');
                    }
                    return originalGetMetadata(metadataKey, target);
                });
                Reflect.getMetadata = mockGetMetadata;

                const mockDiscoveryService = {
                    getControllers: jest.fn().mockReturnValue([]),
                    getProviders: jest.fn().mockReturnValue([{
                        metatype: ErrorService,
                        name: 'ErrorService'
                    }])
                };

                const testModule = await Test.createTestingModule({
                    imports: [GrpcModule.forRoot({
                        protoPath: '/test/path.proto',
                        package: 'test.package',
                    })],
                })
                .overrideProvider(DiscoveryService)
                .useValue(mockDiscoveryService)
                .overrideProvider(ProtoLoaderService)
                .useValue(mockProtoLoaderService)
                .compile();

                const testRegistry = testModule.get(GrpcRegistryService);
                await testModule.init();

                expect(testRegistry.getServiceClients().size).toBe(0);
                
                // Restore original function
                Reflect.getMetadata = originalGetMetadata;
                await testModule.close();
            });
        });
    });
});

describe('GrpcRegistryService - Standalone', () => {
    let registryService: GrpcRegistryService;
    let discoveryService: jest.Mocked<DiscoveryService>;

    beforeEach(() => {
        discoveryService = {
            getControllers: jest.fn(),
            getProviders: jest.fn(),
        } as any;

        const options = {
            protoPath: '/test/path.proto',
            package: 'test.package',
            logging: { level: 'debug' as const },
        };

        registryService = new GrpcRegistryService(
            discoveryService,
            options
        );
    });

    describe('controller metadata extraction', () => {
        it('should extract metadata from valid controller', () => {
            class TestController {
                testMethod() {}
            }

            Reflect.defineMetadata(GRPC_CONTROLLER_METADATA, {
                serviceName: 'TestService',
                package: 'test',
                url: 'localhost:5000'
            }, TestController);

            Reflect.defineMetadata(GRPC_METHOD_METADATA, {
                name: 'TestMethod'
            }, TestController.prototype, 'testMethod');

            const metadata = (registryService as any).extractControllerMetadata(TestController);

            expect(metadata.serviceName).toBe('TestService');
            expect(metadata.package).toBe('test');
            expect(metadata.url).toBe('localhost:5000');
            expect(metadata.methods.size).toBe(1);
            expect(metadata.methods.has('testMethod')).toBe(true);
        });

        it('should throw error for controller without metadata', () => {
            class TestController {}

            expect(() => {
                (registryService as any).extractControllerMetadata(TestController);
            }).toThrow('Missing @GrpcController metadata on TestController');
        });

        it('should handle controller with no methods', () => {
            class TestController {}

            Reflect.defineMetadata(GRPC_CONTROLLER_METADATA, {
                serviceName: 'TestService',
                package: 'test'
            }, TestController);

            const metadata = (registryService as any).extractControllerMetadata(TestController);

            expect(metadata.serviceName).toBe('TestService');
            expect(metadata.methods.size).toBe(0);
        });

        it('should only include gRPC methods', () => {
            class TestController {
                grpcMethod() {}
                normalMethod() {}
                constructor() {}
            }

            Reflect.defineMetadata(GRPC_CONTROLLER_METADATA, {
                serviceName: 'TestService',
                package: 'test'
            }, TestController);

            Reflect.defineMetadata(GRPC_METHOD_METADATA, {
                name: 'GrpcMethod'
            }, TestController.prototype, 'grpcMethod');

            const metadata = (registryService as any).extractControllerMetadata(TestController);

            expect(metadata.methods.size).toBe(1);
            expect(metadata.methods.has('grpcMethod')).toBe(true);
            expect(metadata.methods.has('normalMethod')).toBe(false);
        });
    });
});

describe('Validation Functions', () => {
    const validateGrpcOptions = (GrpcModule as any).validateGrpcOptions;

    it('should validate valid options', () => {
        const options = {
            protoPath: '/test/path.proto',
            package: 'test.package',
        };

        expect(() => validateGrpcOptions(options)).not.toThrow();
    });

    it('should throw for null options', () => {
        expect(() => validateGrpcOptions(null)).toThrow('gRPC options must be a valid object');
    });

    it('should throw for undefined options', () => {
        expect(() => validateGrpcOptions(undefined)).toThrow('gRPC options must be a valid object');
    });

    it('should throw for non-object options', () => {
        expect(() => validateGrpcOptions('string')).toThrow('gRPC options must be a valid object');
    });

    it('should throw for missing protoPath', () => {
        expect(() => validateGrpcOptions({ package: 'test' })).toThrow('protoPath is required and must be a string');
    });

    it('should throw for non-string protoPath', () => {
        expect(() => validateGrpcOptions({ protoPath: 123, package: 'test' })).toThrow('protoPath is required and must be a string');
    });

    it('should throw for missing package', () => {
        expect(() => validateGrpcOptions({ protoPath: 'test.proto' })).toThrow('package is required and must be a string');
    });

    it('should throw for non-string package', () => {
        expect(() => validateGrpcOptions({ protoPath: 'test.proto', package: 123 })).toThrow('package is required and must be a string');
    });

    it('should throw for non-string url', () => {
        expect(() => validateGrpcOptions({
            protoPath: 'test.proto',
            package: 'test',
            url: 123
        })).toThrow('url must be a string');
    });

    it('should accept valid url', () => {
        expect(() => validateGrpcOptions({
            protoPath: 'test.proto',
            package: 'test',
            url: 'localhost:5000'
        })).not.toThrow();
    });

    it('should accept valid maxSendMessageSize', () => {
        expect(() => validateGrpcOptions({
            protoPath: 'test.proto',
            package: 'test',
            maxSendMessageSize: 1024
        })).not.toThrow();
    });

    it('should accept valid maxReceiveMessageSize', () => {
        expect(() => validateGrpcOptions({
            protoPath: 'test.proto',
            package: 'test',
            maxReceiveMessageSize: 2048
        })).not.toThrow();
    });
});
