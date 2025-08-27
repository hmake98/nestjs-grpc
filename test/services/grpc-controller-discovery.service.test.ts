import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

import { GrpcControllerDiscoveryService } from '../../src/services/grpc-controller-discovery.service';
import { GrpcRegistryService } from '../../src/services/grpc-registry.service';
import { GRPC_CONTROLLER_METADATA, GRPC_METHOD_METADATA } from '../../src/constants';
import { ControllerMetadata } from '../../src/interfaces';

// Mock GrpcLogger
const mockLogger = {
    lifecycle: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
};

jest.mock('../../src/utils/logger', () => ({
    GrpcLogger: jest.fn().mockImplementation(() => mockLogger),
}));

// Mock GrpcRegistryService
const mockRegistryService = {
    registerController: jest.fn(),
};

// Mock DiscoveryService
const mockDiscoveryService = {
    getControllers: jest.fn(),
};

// Mock MetadataScanner
const mockMetadataScanner = {
    scanFromPrototype: jest.fn(),
};

// Mock Reflector
const mockReflector = {
    get: jest.fn(),
};

describe('GrpcControllerDiscoveryService', () => {
    let service: GrpcControllerDiscoveryService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GrpcControllerDiscoveryService,
                {
                    provide: DiscoveryService,
                    useValue: mockDiscoveryService,
                },
                {
                    provide: MetadataScanner,
                    useValue: mockMetadataScanner,
                },
                {
                    provide: Reflector,
                    useValue: mockReflector,
                },
                {
                    provide: GrpcRegistryService,
                    useValue: mockRegistryService,
                },
            ],
        }).compile();

        service = module.get<GrpcControllerDiscoveryService>(GrpcControllerDiscoveryService);
    });

    describe('constructor', () => {
        it('should create service successfully', () => {
            expect(service).toBeDefined();
        });
    });

    describe('onModuleInit', () => {
        it('should start discovery process', async () => {
            mockDiscoveryService.getControllers.mockReturnValue([]);

            await service.onModuleInit();

            expect(mockLogger.lifecycle).toHaveBeenCalledWith('Starting gRPC controller discovery');
            expect(mockLogger.debug).toHaveBeenCalledWith('Discovering gRPC controllers');
        });
    });

    describe('discoverAndRegisterControllers', () => {
        it('should discover and register gRPC controllers successfully', async () => {
            const mockController = {
                instance: {
                    constructor: {
                        name: 'TestController',
                    },
                },
            };

            const mockGrpcMetadata = {
                serviceName: 'TestService',
                package: 'test.package',
            };

            mockDiscoveryService.getControllers.mockReturnValue([mockController]);
            mockReflector.get
                .mockReturnValueOnce(mockGrpcMetadata) // GRPC_CONTROLLER_METADATA
                .mockReturnValueOnce(undefined); // __isProvider__

            // Mock method discovery
            const mockPrototype = {
                method1: jest.fn(),
                method2: jest.fn(),
                constructor: jest.fn(),
            };

            Object.setPrototypeOf(mockController.instance, mockPrototype);

            // Mock method metadata
            mockReflector.get
                .mockReturnValueOnce({ methodName: 'Method1' }) // method1 metadata
                .mockReturnValueOnce(undefined) // method2 metadata (no metadata)
                .mockReturnValueOnce(undefined); // Reflect.getMetadata fallback

            await service.onModuleInit();

            expect(mockLogger.debug).toHaveBeenCalledWith('Found 1 controllers to check');
            expect(mockLogger.debug).toHaveBeenCalledWith('Checking controller: TestController');
            expect(mockLogger.debug).toHaveBeenCalledWith('Found gRPC controller: TestController');
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Discovering methods for controller: TestService',
            );
            expect(mockLogger.lifecycle).toHaveBeenCalledWith(
                'Discovered methods for TestService:',
                {
                    methods: ['Method1', 'Method2'],
                    count: 2,
                },
            );
            expect(mockRegistryService.registerController).toHaveBeenCalledWith(
                'TestService',
                mockController.instance,
                expect.objectContaining({
                    serviceName: 'TestService',
                    package: 'test.package',
                    methods: expect.any(Map),
                }),
            );
        });


        it('should skip non-gRPC controllers', async () => {
            const mockController = {
                instance: {
                    constructor: {
                        name: 'HttpController',
                    },
                },
            };

            mockDiscoveryService.getControllers.mockReturnValue([mockController]);
            mockReflector.get.mockReturnValue(undefined); // No gRPC metadata

            await service.onModuleInit();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Skipping regular HTTP controller: HttpController',
            );
            expect(mockRegistryService.registerController).not.toHaveBeenCalled();
        });

        it('should skip provider instances', async () => {
            const mockController = {
                instance: {
                    constructor: {
                        name: 'ProviderService',
                    },
                },
            };

            const mockGrpcMetadata = {
                serviceName: 'TestService',
            };

            mockDiscoveryService.getControllers.mockReturnValue([mockController]);
            mockReflector.get
                .mockReturnValueOnce(mockGrpcMetadata) // GRPC_CONTROLLER_METADATA
                .mockReturnValueOnce(true); // __isProvider__

            await service.onModuleInit();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Skipping non-controller provider: ProviderService',
            );
            expect(mockRegistryService.registerController).not.toHaveBeenCalled();
        });

        it('should handle controllers without instance wrapper', async () => {
            const mockController = {
                constructor: {
                    name: 'DirectController',
                },
            };

            const mockGrpcMetadata = {
                serviceName: 'TestService',
            };

            mockDiscoveryService.getControllers.mockReturnValue([mockController]);
            mockReflector.get
                .mockReturnValueOnce(mockGrpcMetadata) // GRPC_CONTROLLER_METADATA
                .mockReturnValueOnce(undefined); // __isProvider__

            // Mock method discovery
            const mockPrototype = {
                method1: jest.fn(),
                constructor: jest.fn(),
            };

            Object.setPrototypeOf(mockController, mockPrototype);

            // Mock method metadata
            mockReflector.get.mockReturnValueOnce({ methodName: 'Method1' });

            await service.onModuleInit();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Found gRPC controller: DirectController',
            );
            expect(mockRegistryService.registerController).toHaveBeenCalled();
        });

        it('should handle controller registration errors gracefully', async () => {
            const mockController = {
                instance: {
                    constructor: {
                        name: 'ErrorController',
                    },
                },
            };

            const mockGrpcMetadata = {
                serviceName: 'TestService',
            };

            mockDiscoveryService.getControllers.mockReturnValue([mockController]);
            mockReflector.get
                .mockReturnValueOnce(mockGrpcMetadata) // GRPC_CONTROLLER_METADATA
                .mockReturnValueOnce(undefined); // __isProvider__

            // Mock method discovery
            const mockPrototype = {
                method1: jest.fn(),
                constructor: jest.fn(),
            };

            Object.setPrototypeOf(mockController.instance, mockPrototype);

            // Mock method metadata
            mockReflector.get.mockReturnValueOnce({ methodName: 'Method1' });

            // Mock registry service error
            mockRegistryService.registerController.mockRejectedValue(
                new Error('Registration failed'),
            );

            // Should not throw error, just log it
            await expect(service.onModuleInit()).resolves.not.toThrow();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to register controller ErrorController',
                expect.any(Error),
            );
        });

        it('should handle empty controllers list', async () => {
            mockDiscoveryService.getControllers.mockReturnValue([]);

            await service.onModuleInit();

            expect(mockLogger.debug).toHaveBeenCalledWith('Found 0 controllers to check');
            expect(mockRegistryService.registerController).not.toHaveBeenCalled();
        });
    });

});
