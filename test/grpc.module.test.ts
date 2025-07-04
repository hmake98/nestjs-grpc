import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { GrpcModule } from '../src/grpc.module';
import { GrpcClientService } from '../src/services/grpc-client.service';
import { ProtoLoaderService } from '../src/services/proto-loader.service';
import { GrpcExceptionFilter } from '../src/exceptions/grpc.exception-filter';
import { GrpcOptionsFactory } from '../src/interfaces';
import { GRPC_OPTIONS } from '../src/constants';

describe('GrpcModule', () => {
    let module: TestingModule;

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
            }).compile();

            expect(module).toBeDefined();
            expect(module.get(GRPC_OPTIONS)).toEqual(options);
            expect(module.get(GrpcClientService)).toBeDefined();
            expect(module.get(ProtoLoaderService)).toBeDefined();
        });

        it('should throw error for invalid options', async () => {
            await expect(
                Test.createTestingModule({
                    imports: [GrpcModule.forRoot(null as any)],
                }).compile(),
            ).rejects.toThrow('gRPC options must be a valid object');
        });

        it('should throw error for missing protoPath', async () => {
            await expect(
                Test.createTestingModule({
                    imports: [GrpcModule.forRoot({ package: 'test' } as any)],
                }).compile(),
            ).rejects.toThrow('protoPath is required and must be a string');
        });

        it('should throw error for missing package', async () => {
            await expect(
                Test.createTestingModule({
                    imports: [GrpcModule.forRoot({ protoPath: 'test.proto' } as any)],
                }).compile(),
            ).rejects.toThrow('package is required and must be a string');
        });

        it('should throw error for invalid url type', async () => {
            await expect(
                Test.createTestingModule({
                    imports: [
                        GrpcModule.forRoot({
                            protoPath: 'test.proto',
                            package: 'test',
                            url: 123 as any,
                        }),
                    ],
                }).compile(),
            ).rejects.toThrow('url must be a string');
        });

        it('should create module with default options', async () => {
            const options = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            }).compile();

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
            }).compile();

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
                providers: [{ provide: 'CONFIG_SERVICE', useValue: mockService }],
                imports: [
                    GrpcModule.forRootAsync({
                        useFactory: (configService: any) => configService.getConfig(),
                        inject: ['CONFIG_SERVICE'],
                    }),
                ],
            }).compile();

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
            }).compile();

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
                providers: [TestConfigService],
                imports: [
                    GrpcModule.forRootAsync({
                        useExisting: TestConfigService,
                    }),
                ],
            }).compile();

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
                }).compile(),
            ).rejects.toThrow('gRPC options must be a valid object');
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
            }).compile();

            expect(module).toBeDefined();
        });

        it('should create feature module with empty options', async () => {
            const baseOptions = {
                protoPath: '/test/path.proto',
                package: 'test.package',
            };

            module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(baseOptions), GrpcModule.forFeature()],
            }).compile();

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
            }).compile();

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
            }).compile();

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
            }).compile();

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
            }).compile();

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
            }).compile();

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
            }).compile();

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
            }).compile();

            const grpcOptions = module.get(GRPC_OPTIONS);
            expect(grpcOptions.logging).toEqual(options.logging);
        });
    });
});
