import { Test, TestingModule } from '@nestjs/testing';
import * as grpc from '@grpc/grpc-js';
import { GrpcProviderService } from '../../src/services/grpc-provider.service';
import { GrpcProtoService } from '../../src/services/grpc-proto.service';
import { GRPC_OPTIONS } from '../../src/constants';
import { GrpcOptions, ControllerMetadata } from '../../src/interfaces';

// Mock gRPC server
const mockGrpcServer = {
    bindAsync: jest.fn(),
    addService: jest.fn(),
    tryShutdown: jest.fn(),
    forceShutdown: jest.fn(),
};

// Mock gRPC module
jest.mock('@grpc/grpc-js', () => ({
    Server: jest.fn().mockImplementation(() => mockGrpcServer),
    status: {
        INTERNAL: 13,
        INVALID_ARGUMENT: 3,
        NOT_FOUND: 5,
        UNAUTHENTICATED: 16,
        RESOURCE_EXHAUSTED: 8,
    },
    ServerCredentials: {
        createInsecure: jest.fn().mockReturnValue('insecure-credentials'),
        createSsl: jest.fn().mockReturnValue('secure-credentials'),
    },
}));

describe('GrpcProviderService', () => {
    let service: GrpcProviderService;
    let mockProtoService: jest.Mocked<GrpcProtoService>;
    let mockOptions: GrpcOptions;

    const mockControllerMetadata: ControllerMetadata = {
        serviceName: 'TestService',
        methods: new Map([
            ['testMethod', { methodName: 'testMethod' }],
            ['anotherMethod', { methodName: 'anotherMethod' }],
        ]),
    };

    const mockProtoDefinition = {
        TestService: {
            service: {
                originalName: {
                    testMethod: {},
                    anotherMethod: {},
                },
            },
        },
    };

    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();

        mockOptions = {
            protoPath: './test.proto',
            package: 'test.package',
            url: 'localhost:50051',
            secure: false,
            maxSendMessageSize: 1024 * 1024,
            maxReceiveMessageSize: 1024 * 1024,
            logging: {
                level: 'log',
                context: 'test',
            },
        };

        mockProtoService = {
            load: jest.fn().mockResolvedValue(undefined),
            getProtoDefinition: jest.fn().mockReturnValue(mockProtoDefinition),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GrpcProviderService,
                {
                    provide: GRPC_OPTIONS,
                    useValue: mockOptions,
                },
                {
                    provide: GrpcProtoService,
                    useValue: mockProtoService,
                },
            ],
        }).compile();

        service = module.get<GrpcProviderService>(GrpcProviderService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('onModuleInit', () => {
        it('should start the gRPC provider successfully', async () => {
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });

            await service.onModuleInit();

            expect(mockGrpcServer.bindAsync).toHaveBeenCalledWith(
                'localhost:50051',
                'insecure-credentials',
                expect.any(Function)
            );
        });

        it('should handle startup errors', async () => {
            const error = new Error('Startup failed');
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(error, null);
            });

            await expect(service.onModuleInit()).rejects.toThrow('Startup failed');
        });
    });

    describe('onModuleDestroy', () => {
        it('should shutdown the gRPC provider gracefully', async () => {
            // First start the service
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            await service.onModuleInit();

            // Then test shutdown
            mockGrpcServer.tryShutdown.mockImplementation((callback) => {
                callback(null);
            });

            await service.onModuleDestroy();

            expect(mockGrpcServer.tryShutdown).toHaveBeenCalled();
        });

        it('should handle shutdown errors gracefully', async () => {
            // First start the service
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            await service.onModuleInit();

            // Then test shutdown with error
            mockGrpcServer.tryShutdown.mockImplementation((callback) => {
                callback(new Error('Shutdown error'));
            });

            await service.onModuleDestroy();

            expect(mockGrpcServer.forceShutdown).toHaveBeenCalled();
        });
    });

    describe('registerController', () => {
        it('should register a controller successfully', async () => {
            const mockInstance = {
                testMethod: jest.fn(),
                anotherMethod: jest.fn(),
            };

            await service.registerController('TestService', mockInstance, mockControllerMetadata);

            expect(service.getControllerInstances().get('TestService')).toBe(mockInstance);
        });
    });

    describe('getServer', () => {
        it('should return the server instance', () => {
            expect(service.getServer()).toBeNull();
        });
    });

    describe('isServerRunning', () => {
        it('should return false when server is not running', () => {
            expect(service.isServerRunning()).toBe(false);
        });
    });

    describe('getControllerInstances', () => {
        it('should return controller instances map', () => {
            const instances = service.getControllerInstances();
            expect(instances).toBeInstanceOf(Map);
        });
    });

    describe('createServer', () => {
        it('should create server with correct options', async () => {
            await service.onModuleInit();
            
            expect(grpc.Server).toHaveBeenCalledWith({
                'grpc.max_send_message_length': 1024 * 1024,
                'grpc.max_receive_message_length': 1024 * 1024,
            });
        });
    });

    describe('startServer', () => {
        it('should start server successfully', async () => {
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });

            await service.onModuleInit();

            expect(mockGrpcServer.bindAsync).toHaveBeenCalled();
        });

        it('should handle binding errors', async () => {
            const error = new Error('Binding failed');
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(error, null);
            });

            await expect(service.onModuleInit()).rejects.toThrow('Binding failed');
        });
    });

    describe('createServerCredentials', () => {
        it('should create insecure credentials by default', async () => {
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            
            await service.onModuleInit();
            
            expect(grpc.ServerCredentials.createInsecure).toHaveBeenCalled();
        });

        it('should create secure credentials when configured', async () => {
            mockOptions.secure = true;
            mockOptions.privateKey = Buffer.from('private-key');
            mockOptions.certChain = Buffer.from('cert-chain');

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    GrpcProviderService,
                    {
                        provide: GRPC_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: GrpcProtoService,
                        useValue: mockProtoService,
                    },
                ],
            }).compile();

            const secureService = module.get<GrpcProviderService>(GrpcProviderService);

            // Mock successful server start
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });

            await secureService.onModuleInit();

            expect(grpc.ServerCredentials.createSsl).toHaveBeenCalledWith(
                null,
                [{ private_key: Buffer.from('private-key'), cert_chain: Buffer.from('cert-chain') }],
                false
            );
        });
    });

    describe('stopServer', () => {
        it('should stop server gracefully', async () => {
            // First start the service
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            await service.onModuleInit();

            // Then test stop
            mockGrpcServer.tryShutdown.mockImplementation((callback) => {
                callback(null);
            });

            await service.onModuleDestroy();

            expect(mockGrpcServer.tryShutdown).toHaveBeenCalled();
        });
    });

    describe('convertToGrpcError', () => {
        it('should return gRPC errors as-is', () => {
            const grpcError = { code: 13, message: 'Test error' };
            const result = (service as any).convertToGrpcError(grpcError);
            expect(result).toBe(grpcError);
        });

        it('should convert regular errors to gRPC format', () => {
            const regularError = new Error('Regular error');
            const result = (service as any).convertToGrpcError(regularError);
            
            expect(result.code).toBe(grpc.status.INTERNAL);
            expect(result.message).toBe('Regular error');
            expect(result.details).toBe('An unexpected error occurred');
        });

        it('should handle errors without message', () => {
            const errorWithoutMessage = {};
            const result = (service as any).convertToGrpcError(errorWithoutMessage);
            
            expect(result.code).toBe(grpc.status.INTERNAL);
            expect(result.message).toBe('Internal server error');
        });
    });

    describe('findServiceDefinition', () => {
        it('should find service definition directly', () => {
            const result = (service as any).findServiceDefinition(mockProtoDefinition, 'TestService');
            expect(result).toBeDefined();
        });

        it('should return null for invalid proto definition', () => {
            const result = (service as any).findServiceDefinition(null, 'TestService');
            expect(result).toBeNull();
        });

        it('should return null for non-object proto definition', () => {
            const result = (service as any).findServiceDefinition('string', 'TestService');
            expect(result).toBeNull();
        });

        it('should search in nested packages', () => {
            const nestedProto = {
                package1: {
                    TestService: { service: {} },
                },
            };
            const result = (service as any).findServiceDefinition(nestedProto, 'TestService');
            expect(result).toBeDefined();
        });
    });

    describe('extractProtoMethods', () => {
        it('should extract methods from service definition', () => {
            const result = (service as any).extractProtoMethods(
                mockProtoDefinition.TestService,
                'TestService'
            );
            expect(result).toContain('testMethod');
            expect(result).toContain('anotherMethod');
        });

        it('should handle null service definition', () => {
            const result = (service as any).extractProtoMethods(null, 'TestService');
            expect(result).toEqual([]);
        });

        it('should handle undefined service definition', () => {
            const result = (service as any).extractProtoMethods(undefined, 'TestService');
            expect(result).toEqual([]);
        });

        it('should extract methods from function constructor', () => {
            const functionService = {
                testMethod: {},
                anotherMethod: {},
            };
            const result = (service as any).extractProtoMethods(functionService, 'TestService');
            expect(result).toContain('testMethod');
            expect(result).toContain('anotherMethod');
        });

        it('should handle service with methods array', () => {
            const arrayService = {
                service: {
                    methods: [
                        { name: 'method1' },
                        { name: 'method2' },
                    ],
                },
            };
            const result = (service as any).extractProtoMethods(arrayService, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
        });

        it('should handle service with methodsMap', () => {
            const mapService = {
                service: {
                    methodsMap: {
                        method1: {},
                        method2: {},
                    },
                },
            };
            const result = (service as any).extractProtoMethods(mapService, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
        });
    });

    describe('validateMethods', () => {
        it('should validate and register methods successfully', async () => {
            // First start the service
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            await service.onModuleInit();

            // Then test method validation
            await service.registerController('TestService', {}, mockControllerMetadata);
            
            expect(mockGrpcServer.addService).toHaveBeenCalled();
        });
    });

    describe('createMethodHandler', () => {
        it('should create method handler successfully', () => {
            const mockInstance = {
                testMethod: jest.fn().mockResolvedValue('result'),
            };

            const handler = (service as any).createMethodHandler('TestService', 'testMethod');
            expect(typeof handler).toBe('function');
        });
    });

    describe('addServiceToServer', () => {
        it('should add service to server successfully', async () => {
            // First start the service
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            await service.onModuleInit();

            // Then test adding service
            await service.registerController('TestService', {}, mockControllerMetadata);
            
            expect(mockGrpcServer.addService).toHaveBeenCalled();
        });

        it('should handle service definition not found', async () => {
            // Mock proto service to return empty definition
            mockProtoService.getProtoDefinition.mockReturnValue({});

            // First start the service
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            await service.onModuleInit();

            // Then test adding service with missing definition
            await expect(
                service.registerController('TestService', {}, mockControllerMetadata)
            ).rejects.toThrow('Service definition not found for TestService');
        });
    });

    describe('registerPendingControllers', () => {
        it('should register pending controllers when server starts', async () => {
            // Register controller before starting server
            await service.registerController('TestService', {}, mockControllerMetadata);

            // Then start server
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });

            await service.onModuleInit();

            // Should have registered the pending controller
            expect(mockGrpcServer.addService).toHaveBeenCalled();
        });

        it('should handle proto service load failure', async () => {
            // Mock proto service to reject
            mockProtoService.load.mockRejectedValue(new Error('Load failed'));

            // Register controller before starting server
            await service.registerController('TestService', {}, mockControllerMetadata);

            // Then start server
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });

            await service.onModuleInit();

            // Should handle failure gracefully
            expect(mockGrpcServer.addService).not.toHaveBeenCalled();
        });
    });

    describe('secure server configuration', () => {
        it('should require private key and certificate for secure server', async () => {
            mockOptions.secure = true;
            // Missing privateKey and certChain

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    GrpcProviderService,
                    {
                        provide: GRPC_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: GrpcProtoService,
                        useValue: mockProtoService,
                    },
                ],
            }).compile();

            const secureService = module.get<GrpcProviderService>(GrpcProviderService);

            // Should throw error when trying to create secure credentials without certs
            await expect(secureService.onModuleInit()).rejects.toThrow(
                'Private key and certificate chain are required for secure server'
            );
        });
    });
});