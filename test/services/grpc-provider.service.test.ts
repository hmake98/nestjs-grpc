import { Test, TestingModule } from '@nestjs/testing';
import * as grpc from '@grpc/grpc-js';

import { GrpcProviderService } from '../../src/services/grpc-provider.service';
import { GrpcProtoService } from '../../src/services/grpc-proto.service';
import { GrpcOptions, ControllerMetadata } from '../../src/interfaces';

// Mock grpc module
jest.mock('@grpc/grpc-js', () => ({
    Server: jest.fn().mockImplementation(() => ({
        bindAsync: jest.fn(),
        tryShutdown: jest.fn(),
        forceShutdown: jest.fn(),
        addService: jest.fn(),
    })),
    ServerCredentials: {
        createInsecure: jest.fn(() => ({ _isInsecure: true })),
        createSsl: jest.fn(() => ({ _isSsl: true })),
    },
    status: {
        INTERNAL: 13,
        UNAVAILABLE: 14,
    },
}));

// Mock GrpcProtoService
const mockProtoService = {
    load: jest.fn(),
    getProtoDefinition: jest.fn(),
};

// Mock GrpcLogger
const mockLogger = {
    lifecycle: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    performance: jest.fn(),
};

jest.mock('../../src/utils/logger', () => ({
    GrpcLogger: jest.fn().mockImplementation(() => mockLogger),
}));

describe('GrpcProviderService', () => {
    let service: GrpcProviderService;
    let mockGrpcServer: any;
    let mockOptions: GrpcOptions;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Create mock gRPC server
        mockGrpcServer = {
            bindAsync: jest.fn(),
            tryShutdown: jest.fn(),
            forceShutdown: jest.fn(),
            addService: jest.fn(),
        };

        (grpc.Server as jest.Mock).mockImplementation(() => mockGrpcServer);

        // Default options
        mockOptions = {
            url: 'localhost:50051',
            secure: false,
            maxSendMessageSize: 1024,
            maxReceiveMessageSize: 2048,
            protoPath: '/test/path.proto',
            package: 'test.package',
            logging: {
                level: 'log',
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GrpcProviderService,
                {
                    provide: 'GRPC_OPTIONS',
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

    describe('constructor', () => {
        it('should create service with default options', () => {
            expect(service).toBeDefined();
        });

        it('should create service with custom options', async () => {
            const customOptions: GrpcOptions = {
                ...mockOptions,
                secure: true,
                privateKey: Buffer.from('private-key'),
                certChain: Buffer.from('cert-chain'),
                rootCerts: Buffer.from('root-certs'),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    GrpcProviderService,
                    {
                        provide: 'GRPC_OPTIONS',
                        useValue: customOptions,
                    },
                    {
                        provide: GrpcProtoService,
                        useValue: mockProtoService,
                    },
                ],
            }).compile();

            const customService = module.get<GrpcProviderService>(GrpcProviderService);
            expect(customService).toBeDefined();
        });
    });

    describe('onModuleInit', () => {
        it('should start server successfully', async () => {
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });

            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await service.onModuleInit();

            expect(mockLogger.lifecycle).toHaveBeenCalledWith('Starting gRPC provider');
            expect(mockLogger.lifecycle).toHaveBeenCalledWith(
                'gRPC provider started successfully',
                {
                    url: 'localhost:50051',
                    secure: false,
                    controllers: 0,
                },
            );
        });

        it('should handle server start failure', async () => {
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(new Error('Bind failed'), null);
            });

            await expect(service.onModuleInit()).rejects.toThrow('Bind failed');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to start gRPC provider',
                expect.any(Error),
            );
        });
    });

    describe('onModuleDestroy', () => {
        it('should shutdown server gracefully', async () => {
            // Start server first
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await service.onModuleInit();

            // Mock graceful shutdown
            mockGrpcServer.tryShutdown.mockImplementation(callback => {
                callback(null);
            });

            await service.onModuleDestroy();

            expect(mockLogger.lifecycle).toHaveBeenCalledWith('Shutting down gRPC provider');
            expect(mockLogger.lifecycle).toHaveBeenCalledWith('gRPC provider shutdown complete');
        });

        it('should handle shutdown errors gracefully', async () => {
            // Start server first
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await service.onModuleInit();

            // Mock shutdown error
            mockGrpcServer.tryShutdown.mockImplementation(callback => {
                callback(new Error('Shutdown error'));
            });

            await service.onModuleDestroy();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error during graceful shutdown, forcing shutdown',
                expect.any(Error),
            );
        });

        it('should handle errors during module destroy gracefully', async () => {
            // Start server first
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await service.onModuleInit();

            // Mock error in stopServer method by making tryShutdown throw
            mockGrpcServer.tryShutdown = jest.fn().mockImplementation(() => {
                throw new Error('Stop server error');
            });

            await service.onModuleDestroy();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error during gRPC provider shutdown',
                expect.any(Error),
            );
        });
    });

    describe('getServer', () => {
        it('should return server instance', async () => {
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await service.onModuleInit();

            const server = service.getServer();
            expect(server).toBe(mockGrpcServer);
        });

        it('should return null when server not created', () => {
            const server = service.getServer();
            expect(server).toBeNull();
        });
    });

    describe('isServerRunning', () => {
        it('should return true when server is running', async () => {
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await service.onModuleInit();

            expect(service.isServerRunning()).toBe(true);
        });

        it('should return false when server is not running', () => {
            expect(service.isServerRunning()).toBe(false);
        });
    });

    describe('getControllerInstances', () => {
        it('should return empty map initially', () => {
            const instances = service.getControllerInstances();
            expect(instances.size).toBe(0);
        });

        it('should return registered controller instances', async () => {
            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, mockMetadata);

            const instances = service.getControllerInstances();
            expect(instances.get('TestService')).toBe(mockController);
        });
    });

    describe('registerController', () => {
        it('should register controller successfully', async () => {
            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, mockMetadata);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Registered controller instance for service: TestService',
            );
        });

        it('should handle registration errors', async () => {
            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            // Start server first and mock addServiceToServer to throw error
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockImplementation(() => {
                throw new Error('Proto error');
            });

            await service.onModuleInit();

            await expect(
                service.registerController('TestService', mockController, mockMetadata),
            ).rejects.toThrow('Proto error');
        });

        it('should register controller when server is running and service not registered', async () => {
            // Start server first
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({
                TestService: { service: { originalName: { testMethod: {} } } },
            });

            await service.onModuleInit();

            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, mockMetadata);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Registered controller instance for service: TestService',
            );
        });

        it('should skip registration when server not ready', async () => {
            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, mockMetadata);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Server not ready, will register service TestService when server starts',
            );
        });

        it('should skip registration when service already registered', async () => {
            // Start server first
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({
                TestService: { service: { originalName: { testMethod: {} } } },
            });

            await service.onModuleInit();

            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            // Register once
            await service.registerController('TestService', mockController, mockMetadata);
            // Register again
            await service.registerController('TestService', mockController, mockMetadata);

            expect(mockLogger.debug).toHaveBeenCalledWith('Service TestService already registered');
        });
    });

    describe('registerPendingControllers', () => {
        it('should handle no pending controllers', async () => {
            await (service as any).registerPendingControllers();
            expect(mockLogger.debug).toHaveBeenCalledWith('No pending controllers to register');
        });


        it('should handle proto service load errors', async () => {
            // Add a pending controller
            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, mockMetadata);

            // Mock proto service load error
            mockProtoService.load.mockRejectedValue(new Error('Load error'));

            await (service as any).registerPendingControllers();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to load proto service',
                expect.any(Error),
            );
        });

        it('should handle controller registration errors during pending registration', async () => {
            await (service as any).createServer();

            // Add a pending controller
            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, mockMetadata);

            // Mock proto service success but addServiceToServer failure
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await (service as any).registerPendingControllers();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Some controllers failed to register'),
            );
        });

        it('should register pending controllers successfully', async () => {
            await (service as any).createServer();

            // Add a pending controller
            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, mockMetadata);

            // Mock proto service success
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({
                TestService: { service: { originalName: { testMethod: {} } } },
            });

            await (service as any).registerPendingControllers();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Successfully registered pending controller: TestService',
            );
        });
    });

    describe('createServer', () => {
        it('should create server with correct options', async () => {
            await (service as any).createServer();

            expect(grpc.Server).toHaveBeenCalledWith({
                'grpc.max_send_message_length': 1024,
                'grpc.max_receive_message_length': 2048,
            });
            expect(mockLogger.debug).toHaveBeenCalledWith('gRPC server instance created');
        });
    });

    describe('startServer', () => {
        it('should start server successfully', async () => {
            await (service as any).createServer();

            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });

            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await (service as any).startServer();

            expect(mockGrpcServer.bindAsync).toHaveBeenCalledWith(
                'localhost:50051',
                { _isInsecure: true },
                expect.any(Function),
            );
        });

        it('should handle bind errors', async () => {
            await (service as any).createServer();

            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(new Error('Bind failed'), null);
            });

            await expect((service as any).startServer()).rejects.toThrow(
                'Failed to bind server to localhost:50051: Bind failed',
            );
        });

        it('should handle errors in registerPendingControllers during start', async () => {
            await (service as any).createServer();

            // Add a pending controller to trigger registerPendingControllers
            const mockController = { testMethod: jest.fn() };
            const mockMetadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, mockMetadata);

            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });

            // Mock proto service to fail
            mockProtoService.load.mockRejectedValue(new Error('Proto load failed'));

            // The error is handled gracefully, so we just verify the server starts
            await (service as any).startServer();

            // Verify the error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to load proto service',
                expect.any(Error),
            );
        });
    });

    describe('createServerCredentials', () => {
        it('should create insecure credentials by default', () => {
            const credentials = (service as any).createServerCredentials();
            expect(credentials).toEqual({ _isInsecure: true });
        });

        it('should create SSL credentials when secure is true', () => {
            const secureOptions: GrpcOptions = {
                ...mockOptions,
                secure: true,
                privateKey: Buffer.from('private-key'),
                certChain: Buffer.from('cert-chain'),
                rootCerts: Buffer.from('root-certs'),
            };

            const secureService = new GrpcProviderService(secureOptions, mockProtoService as any);
            const credentials = (secureService as any).createServerCredentials();

            expect(grpc.ServerCredentials.createSsl).toHaveBeenCalledWith(
                Buffer.from('root-certs'),
                [
                    {
                        private_key: Buffer.from('private-key'),
                        cert_chain: Buffer.from('cert-chain'),
                    },
                ],
                false,
            );
        });

        it('should throw error when secure is true but credentials are missing', () => {
            const secureOptions: GrpcOptions = {
                ...mockOptions,
                secure: true,
            };

            const secureService = new GrpcProviderService(secureOptions, mockProtoService as any);

            expect(() => (secureService as any).createServerCredentials()).toThrow(
                'Private key and certificate chain are required for secure server',
            );
        });
    });

    describe('stopServer', () => {
        it('should stop server gracefully', async () => {
            // Start server first
            await (service as any).createServer();
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await (service as any).startServer();

            // Mock graceful shutdown
            mockGrpcServer.tryShutdown.mockImplementation(callback => {
                callback(null);
            });

            await (service as any).stopServer();

            expect(mockGrpcServer.tryShutdown).toHaveBeenCalled();
        });

        it('should force shutdown on error', async () => {
            // Start server first
            await (service as any).createServer();
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });
            mockProtoService.load.mockResolvedValue({});
            mockProtoService.getProtoDefinition.mockReturnValue({});

            await (service as any).startServer();

            // Mock shutdown error
            mockGrpcServer.tryShutdown.mockImplementation(callback => {
                callback(new Error('Shutdown error'));
            });

            await (service as any).stopServer();

            expect(mockGrpcServer.forceShutdown).toHaveBeenCalled();
        });

        it('should do nothing when server is not running', async () => {
            await (service as any).stopServer();
            expect(mockGrpcServer.tryShutdown).not.toHaveBeenCalled();
        });
    });

    describe('convertToGrpcError', () => {
        it('should return gRPC error as-is', () => {
            const grpcError = { code: grpc.status.UNAVAILABLE, message: 'Service unavailable' };
            const result = (service as any).convertToGrpcError(grpcError);
            expect(result).toBe(grpcError);
        });

        it('should convert regular error to gRPC error', () => {
            const regularError = new Error('Something went wrong');
            const result = (service as any).convertToGrpcError(regularError);

            expect(result.code).toBe(grpc.status.INTERNAL);
            expect(result.message).toBe('Something went wrong');
            expect(result.details).toBe('An unexpected error occurred');
        });

        it('should handle error without message', () => {
            const errorWithoutMessage = {};
            const result = (service as any).convertToGrpcError(errorWithoutMessage);

            expect(result.code).toBe(grpc.status.INTERNAL);
            expect(result.message).toBe('Internal server error');
            expect(result.details).toBe('An unexpected error occurred');
        });
    });

    describe('findServiceDefinition', () => {
        it('should find service directly in proto definition', () => {
            const protoDefinition = {
                TestService: { service: { originalName: { method1: {} } } },
            };

            const result = (service as any).findServiceDefinition(protoDefinition, 'TestService');
            expect(result).toEqual(protoDefinition.TestService);
        });

        it('should find service function constructor', () => {
            const serviceConstructor = function TestService() {};
            serviceConstructor.service = { originalName: { method1: {} } };
            const protoDefinition = {
                TestService: serviceConstructor,
            };

            const result = (service as any).findServiceDefinition(protoDefinition, 'TestService');
            expect(result).toEqual(serviceConstructor);
        });

        it('should return null for invalid service definition', () => {
            const protoDefinition = {
                TestService: 'not-a-valid-service',
            };

            const result = (service as any).findServiceDefinition(protoDefinition, 'TestService');
            expect(result).toBeNull();
        });

        it('should find service in nested package', () => {
            const testService = { service: { originalName: { method1: {} } } };
            const protoDefinition = {
                com: {
                    TestService: testService,
                },
            };

            const result = (service as any).findServiceDefinition(protoDefinition, 'TestService');
            expect(result).toEqual(testService);
        });

        it('should return null for invalid proto definition', () => {
            const result = (service as any).findServiceDefinition(null, 'TestService');
            expect(result).toBeNull();
        });

        it('should return null when service not found', () => {
            const protoDefinition = { OtherService: {} };
            const result = (service as any).findServiceDefinition(protoDefinition, 'TestService');
            expect(result).toBeNull();
        });
    });

    describe('extractProtoMethods', () => {
        it('should extract methods from service.originalName', () => {
            const serviceDefinition = {
                service: {
                    originalName: {
                        method1: {},
                        method2: {},
                    },
                },
            };

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
        });

        it('should extract methods from service.methods', () => {
            const serviceDefinition = {
                service: {
                    methods: {
                        method1: {},
                        method2: {},
                    },
                },
            };

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
        });

        it('should extract methods from service.methodsMap', () => {
            const serviceDefinition = {
                service: {
                    methodsMap: {
                        method1: {},
                        method2: {},
                    },
                },
            };

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
        });

        it('should extract methods from service.methods array', () => {
            const serviceDefinition = {
                service: {
                    methods: [
                        { name: 'method1' },
                        { originalName: 'method2' },
                        { otherProperty: 'value' }, // Should be filtered out
                    ],
                },
            };

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
            expect(result).not.toContain('otherProperty');
        });

        it('should extract methods from direct service keys', () => {
            const serviceDefinition = {
                service: {
                    method1: {},
                    method2: {},
                    originalName: { someMethod: {} }, // Should be excluded
                    methods: { anotherMethod: {} }, // Should be excluded
                    methodsMap: { yetAnother: {} }, // Should be excluded
                },
            };

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
        });

        it('should extract methods from function properties', () => {
            const serviceDefinition = function TestService() {};
            serviceDefinition.method1 = {};
            serviceDefinition.method2 = {};
            serviceDefinition.service = { originalName: {} }; // Should be excluded

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
        });

        it('should extract methods from direct object properties', () => {
            const serviceDefinition = {
                method1: {},
                method2: {},
                service: {}, // Should be excluded
                constructor: {}, // Should be excluded
                prototype: {}, // Should be excluded
            };

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
        });

        it('should extract methods from service constructor with service property', () => {
            const serviceDefinition = function TestService() {};
            serviceDefinition.service = {
                originalName: {
                    method1: {},
                    method2: {},
                },
            };

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('method2');
        });

        it('should return empty array for null service definition', () => {
            const result = (service as any).extractProtoMethods(null, 'TestService');
            expect(result).toEqual([]);
        });

        it('should filter out invalid method names', () => {
            const serviceDefinition = {
                service: {
                    originalName: {
                        method1: {},
                        '': {},
                        '   ': {},
                        prototype: {},
                        validMethod: {},
                    },
                },
            };

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result).toContain('method1');
            expect(result).toContain('validMethod');
            expect(result).not.toContain('');
            expect(result).not.toContain('   ');
            expect(result).not.toContain('prototype');
        });

        it('should remove duplicates', () => {
            const serviceDefinition = {
                service: {
                    originalName: { method1: {} },
                    methods: { method1: {} },
                },
            };

            const result = (service as any).extractProtoMethods(serviceDefinition, 'TestService');
            expect(result.filter(m => m === 'method1')).toHaveLength(1);
        });
    });

    describe('validateMethods', () => {
        it('should validate and register methods successfully', async () => {
            const metadata: ControllerMetadata = {
                methods: new Map([
                    ['method1', { methodName: 'method1' }],
                    ['method2', { methodName: 'method2' }],
                ]),
                serviceName: 'TestService',
            };

            const serviceDefinition = {
                service: {
                    originalName: {
                        method1: {},
                        method2: {},
                    },
                },
            };

            await (service as any).createServer();
            mockGrpcServer.bindAsync.mockImplementation((url, credentials, callback) => {
                callback(null, 50051);
            });

            await (service as any).startServer();

            await (service as any).validateMethods('TestService', metadata, serviceDefinition);

            expect(mockGrpcServer.addService).toHaveBeenCalled();
        });

        it('should skip registration when no valid methods found', async () => {
            const metadata: ControllerMetadata = {
                methods: new Map([['invalidMethod', { methodName: 'invalidMethod' }]]),
                serviceName: 'TestService',
            };

            const serviceDefinition = {
                service: {
                    originalName: { method1: {} },
                },
            };

            await (service as any).validateMethods('TestService', metadata, serviceDefinition);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Method invalidMethod not found in proto definition. Available: method1',
            );
            expect(mockGrpcServer.addService).not.toHaveBeenCalled();
        });

        it('should handle addService error with function service definition', async () => {
            const metadata: ControllerMetadata = {
                methods: new Map([['method1', { methodName: 'method1' }]]),
                serviceName: 'TestService',
            };

            const serviceDefinition = function TestService() {};
            serviceDefinition.service = { originalName: { method1: {} } };

            await (service as any).createServer();
            mockGrpcServer.addService.mockImplementation(() => {
                throw new Error('Add service failed');
            });

            await expect(
                (service as any).validateMethods('TestService', metadata, serviceDefinition),
            ).rejects.toThrow('Add service failed');
        });

        it('should handle addService error with object service definition', async () => {
            const metadata: ControllerMetadata = {
                methods: new Map([['method1', { methodName: 'method1' }]]),
                serviceName: 'TestService',
            };

            const serviceDefinition = {
                service: { originalName: { method1: {} } },
            };

            await (service as any).createServer();
            mockGrpcServer.addService.mockImplementation(() => {
                throw new Error('Add service failed');
            });

            await expect(
                (service as any).validateMethods('TestService', metadata, serviceDefinition),
            ).rejects.toThrow('Add service failed');
        });

        it('should use originalMethodName from metadata when available', async () => {
            const metadata: ControllerMetadata = {
                methods: new Map([
                    ['method1', { methodName: 'method1', originalMethodName: 'customMethod' }],
                ]),
                serviceName: 'TestService',
            };

            const serviceDefinition = {
                service: { originalName: { method1: {} } },
            };

            await (service as any).createServer();

            const createMethodHandlerSpy = jest.spyOn(service as any, 'createMethodHandler');

            await (service as any).validateMethods('TestService', metadata, serviceDefinition);

            expect(createMethodHandlerSpy).toHaveBeenCalledWith('TestService', 'customMethod');
        });
    });

    describe('createMethodHandler', () => {
        it('should create method handler successfully', async () => {
            const mockController = {
                testMethod: jest.fn().mockResolvedValue('success'),
            };

            // Register controller first
            const metadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, metadata);

            const handler = (service as any).createMethodHandler('TestService', 'testMethod');

            const mockCall = { request: { data: 'test' } };
            const mockCallback = jest.fn();

            await handler(mockCall, mockCallback);

            expect(mockController.testMethod).toHaveBeenCalledWith({ data: 'test' });
            expect(mockCallback).toHaveBeenCalledWith(null, 'success');
        });

        it('should handle method not found error', async () => {
            const mockController = {};

            // Register controller first
            const metadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, metadata);

            const handler = (service as any).createMethodHandler('TestService', 'testMethod');

            const mockCall = { request: { data: 'test' } };
            const mockCallback = jest.fn();

            await handler(mockCall, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: grpc.status.INTERNAL,
                    message: 'Method testMethod not found in controller TestService',
                }),
            );
        });

        it('should handle controller instance not found error', async () => {
            const handler = (service as any).createMethodHandler('TestService', 'testMethod');

            const mockCall = { request: { data: 'test' } };
            const mockCallback = jest.fn();

            await handler(mockCall, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: grpc.status.INTERNAL,
                    message: 'Controller instance not found for service TestService',
                }),
            );
        });

        it('should handle method execution errors', async () => {
            const mockController = {
                testMethod: jest.fn().mockRejectedValue(new Error('Method error')),
            };

            // Register controller first
            const metadata: ControllerMetadata = {
                methods: new Map([['testMethod', { methodName: 'testMethod' }]]),
                serviceName: 'TestService',
            };

            await service.registerController('TestService', mockController, metadata);

            const handler = (service as any).createMethodHandler('TestService', 'testMethod');

            const mockCall = { request: { data: 'test' } };
            const mockCallback = jest.fn();

            await handler(mockCall, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: grpc.status.INTERNAL,
                    message: 'Method error',
                }),
            );
        });
    });

    describe('addServiceToServer', () => {
        it('should add service to server successfully', async () => {
            await (service as any).createServer();

            const metadata: ControllerMetadata = {
                methods: new Map([['method1', { methodName: 'method1' }]]),
                serviceName: 'TestService',
            };

            const serviceDefinition = {
                service: {
                    originalName: { method1: {} },
                },
            };

            // Mock proto service to return the service definition
            mockProtoService.getProtoDefinition.mockReturnValue({
                TestService: serviceDefinition,
            });

            await (service as any).addServiceToServer('TestService', metadata);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Looking for service definition: TestService',
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Service definition found for TestService',
            );
        });

        it('should throw error when server not initialized', async () => {
            const metadata: ControllerMetadata = {
                methods: new Map([['method1', { methodName: 'method1' }]]),
                serviceName: 'TestService',
            };

            await expect(
                (service as any).addServiceToServer('TestService', metadata),
            ).rejects.toThrow('Server not initialized');
        });

        it('should throw error when service definition not found', async () => {
            await (service as any).createServer();

            mockProtoService.getProtoDefinition.mockReturnValue({});

            const metadata: ControllerMetadata = {
                methods: new Map([['method1', { methodName: 'method1' }]]),
                serviceName: 'TestService',
            };

            await expect(
                (service as any).addServiceToServer('TestService', metadata),
            ).rejects.toThrow('Service definition not found for TestService');
        });
    });
});
