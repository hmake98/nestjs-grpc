import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { Module, Controller } from '@nestjs/common';
import { GrpcModule } from '../src/grpc.module';
import { GrpcClientService } from '../src/services/grpc-client.service';
import { GrpcProtoService } from '../src/services/grpc-proto.service';
import { GrpcOptionsFactory } from '../src/interfaces';
import {
    GRPC_OPTIONS,
    GRPC_CONTROLLER_METADATA,
    GRPC_SERVICE_METADATA,
    GRPC_METHOD_METADATA,
} from '../src/constants';
import { GrpcController } from '../src/decorators/grpc-controller.decorator';
import { GrpcService } from '../src/decorators/grpc-service.decorator';
import { GrpcMethod } from '../src/decorators/grpc-method.decorator';

describe('GrpcModule', () => {
    let module: TestingModule;

    const mockProtoService = {
        onModuleInit: jest.fn(),
        load: jest.fn(),
        getService: jest.fn(),
        getPackageDefinition: jest.fn(),
        getProtoDefinition: jest.fn().mockReturnValue({
            TestService: jest.fn().mockImplementation(() => ({
                // Mock gRPC client methods
                call: jest.fn(),
                makeUnaryRequest: jest.fn(),
                makeServerStreamRequest: jest.fn(),
                makeClientStreamRequest: jest.fn(),
                makeBidiStreamRequest: jest.fn(),
            })),
        }),
    };

    afterEach(async () => {
        if (module) {
            await module.close();
        }
    });

    describe('forProvider', () => {
        it('should create module with valid options', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forProvider(options)],
            })
                .overrideProvider(GrpcProtoService)
                .useValue(mockProtoService)
                .compile();

            expect(module).toBeDefined();
            expect(module.get(GRPC_OPTIONS)).toEqual(options);
            expect(module.get(GrpcClientService)).toBeDefined();
            expect(module.get(GrpcProtoService)).toBeDefined();
        });

        it('should throw error for invalid options', () => {
            expect(() => {
                GrpcModule.forProvider(null as any);
            }).toThrow('gRPC options must be a valid object');
        });

        it('should throw error for missing protoPath', () => {
            expect(() => {
                GrpcModule.forProvider({ package: 'test' } as any);
            }).toThrow('protoPath is required and must be a string');
        });

        it('should throw error for missing package', () => {
            expect(() => {
                GrpcModule.forProvider({ protoPath: 'test.proto' } as any);
            }).toThrow('package is required and must be a string');
        });

        it('should throw error for invalid url type', () => {
            expect(() => {
                GrpcModule.forProvider({
                    protoPath: 'test.proto',
                    package: 'test',
                    url: 123 as any,
                });
            }).toThrow('url must be a string');
        });

        it('should throw error for invalid maxSendMessageSize', () => {
            expect(() => {
                GrpcModule.forProvider({
                    protoPath: 'test.proto',
                    package: 'test',
                    maxSendMessageSize: -1,
                });
            }).toThrow('maxSendMessageSize must be a positive number');
        });

        it('should throw error for non-number maxSendMessageSize', () => {
            expect(() => {
                GrpcModule.forProvider({
                    protoPath: 'test.proto',
                    package: 'test',
                    maxSendMessageSize: 'invalid' as any,
                });
            }).toThrow('maxSendMessageSize must be a positive number');
        });

        it('should throw error for invalid maxReceiveMessageSize', () => {
            expect(() => {
                GrpcModule.forProvider({
                    protoPath: 'test.proto',
                    package: 'test',
                    maxReceiveMessageSize: 0,
                });
            }).toThrow('maxReceiveMessageSize must be a positive number');
        });

        it('should throw error for non-number maxReceiveMessageSize', () => {
            expect(() => {
                GrpcModule.forProvider({
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
                imports: [GrpcModule.forProvider(options)],
            })
                .overrideProvider(GrpcProtoService)
                .useValue(mockProtoService)
                .compile();

            const grpcOptions = module.get(GRPC_OPTIONS);
            expect(grpcOptions.protoPath).toBe(options.protoPath);
            expect(grpcOptions.package).toBe(options.package);
            expect(grpcOptions.url).toBeUndefined();
        });
    });

    describe('forProviderAsync', () => {
        it('should create module with factory', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forProviderAsync({
                        useFactory: () => options,
                    }),
                ],
            })
                .overrideProvider(GrpcProtoService)
                .useValue(mockProtoService)
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
                    GrpcModule.forProviderAsync({
                        useFactory: (configService: any) => configService.getConfig(),
                        inject: ['CONFIG_SERVICE'],
                        providers: [{ provide: 'CONFIG_SERVICE', useValue: mockService }],
                    }),
                ],
            })
                .overrideProvider(GrpcProtoService)
                .useValue(mockProtoService)
                .compile();

            expect(module).toBeDefined();
            expect(module.get(GRPC_OPTIONS)).toEqual({
                ...options,
            });
        });

        it('should create module with class factory', async () => {
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
                    GrpcModule.forProviderAsync({
                        useClass: TestConfigService,
                    }),
                ],
            })
                .overrideProvider(GrpcProtoService)
                .useValue(mockProtoService)
                .compile();

            expect(module).toBeDefined();
            expect(module.get(GRPC_OPTIONS)).toEqual({
                ...options,
            });
        });

        it('should throw error for invalid async options', () => {
            expect(() => {
                GrpcModule.forProviderAsync(null as any);
            }).toThrow('Async options must be a valid object');
        });

        it('should throw error for missing factory configuration', () => {
            expect(() => {
                GrpcModule.forProviderAsync({} as any);
            }).toThrow('One of useFactory, useClass, or useExisting must be provided');
        });

        it('should throw error for invalid factory configuration', () => {
            expect(() => {
                GrpcModule.forProviderAsync({
                    useFactory: 'invalid' as any,
                });
            }).toThrow('One of useFactory, useClass, or useExisting must be provided');
        });
    });

    describe('forConsumer', () => {
        it('should create consumer module with valid options', async () => {
            const options = {
                serviceName: 'TestService',
                protoPath: '/test/path.proto',
                package: 'test.package',
                url: 'localhost:50051',
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forConsumer(options)],
            })
                .overrideProvider(GrpcProtoService)
                .useValue(mockProtoService)
                .compile();

            expect(module).toBeDefined();
            expect(module.get(GrpcClientService)).toBeDefined();
        });

        it('should throw error for missing protoPath in consumer', () => {
            expect(() => {
                GrpcModule.forConsumer({
                    serviceName: 'TestService',
                    package: 'test',
                    url: 'localhost:50051',
                } as any);
            }).toThrow('protoPath is required and must be a string');
        });

        it('should throw error for missing package in consumer', () => {
            expect(() => {
                GrpcModule.forConsumer({
                    serviceName: 'TestService',
                    protoPath: 'test.proto',
                    url: 'localhost:50051',
                } as any);
            }).toThrow('package is required and must be a string');
        });

        it('should throw error for missing url in consumer', () => {
            expect(() => {
                GrpcModule.forConsumer({
                    serviceName: 'TestService',
                    protoPath: 'test.proto',
                    package: 'test',
                } as any);
            }).toThrow('url is required and must be a string');
        });
    });

    describe('forConsumerAsync', () => {
        it('should create consumer module with factory', async () => {
            const options = {
                serviceName: 'TestService',
                protoPath: '/test/path.proto',
                package: 'test.package',
                url: 'localhost:50051',
            };

            module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forConsumerAsync({
                        useFactory: () => options,
                    }),
                ],
            })
                .overrideProvider(GrpcProtoService)
                .useValue(mockProtoService)
                .compile();

            expect(module).toBeDefined();
            expect(module.get(GrpcClientService)).toBeDefined();
        });

        it('should throw error for invalid consumer async options', () => {
            expect(() => {
                GrpcModule.forConsumerAsync(null as any);
            }).toThrow('Async consumer options must be a valid object');
        });

        it('should throw error for missing consumer factory configuration', () => {
            expect(() => {
                GrpcModule.forConsumerAsync({} as any);
            }).toThrow('One of useFactory, useClass, or useExisting must be provided');
        });
    });
});
