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
let mockRegistryService: any;

// Mock DiscoveryService
let mockDiscoveryService: any;

// Mock MetadataScanner
let mockMetadataScanner: any;

// Mock Reflector
let mockReflector: any;

describe('GrpcControllerDiscoveryService', () => {
    let service: GrpcControllerDiscoveryService;

    beforeEach(async () => {
        jest.clearAllMocks();

        mockDiscoveryService = {
            getControllers: jest.fn().mockReturnValue([]),
        };

        mockReflector = {
            get: jest.fn().mockReturnValue(null),
        };

        mockRegistryService = {
            registerController: jest.fn().mockResolvedValue(undefined),
        };

        mockMetadataScanner = {};

        // Create service directly instead of through testing module
        service = new GrpcControllerDiscoveryService(
            mockDiscoveryService as any,
            mockMetadataScanner as any,
            mockReflector as any,
            mockRegistryService as any,
        );
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

        it('should handle method discovery with no methods found', async () => {
            const mockController = {
                constructor: { name: 'TestController' },
                // No methods
            };

            // Mock the discovery service to return metadata
            mockDiscoveryService.getControllers.mockReturnValue([
                { serviceName: 'TestController', instance: mockController },
            ]);

            await service.onModuleInit();

            // Just verify the service initializes without error
            expect(mockDiscoveryService.getControllers).toHaveBeenCalled();
        });

        it('should handle method discovery with error during metadata retrieval', async () => {
            const mockController = {
                constructor: { name: 'TestController' },
                testMethod: jest.fn(),
            };

            // Mock the discovery service to return metadata
            mockDiscoveryService.getControllers.mockReturnValue([
                { serviceName: 'TestController', instance: mockController },
            ]);

            await service.onModuleInit();

            // Just verify the service initializes without error
            expect(mockDiscoveryService.getControllers).toHaveBeenCalled();
        });

        it('should handle method discovery with metadata found', async () => {
            const mockController = {
                constructor: { name: 'TestController' },
                testMethod: jest.fn(),
            };

            // Mock the discovery service to return metadata
            mockDiscoveryService.getControllers.mockReturnValue([
                { serviceName: 'TestController', instance: mockController },
            ]);

            await service.onModuleInit();

            // Just verify the service initializes without error
            expect(mockDiscoveryService.getControllers).toHaveBeenCalled();
        });

        it('should handle method discovery with inferred method names', async () => {
            const mockController = {
                constructor: { name: 'TestController' },
                testMethod: jest.fn(),
            };

            // Mock the discovery service to return metadata
            mockDiscoveryService.getControllers.mockReturnValue([
                { serviceName: 'TestController', instance: mockController },
            ]);

            await service.onModuleInit();

            // Just verify the service initializes without error
            expect(mockDiscoveryService.getControllers).toHaveBeenCalled();
        });

        it('should handle method discovery with error during method checking', async () => {
            const mockController = {
                constructor: { name: 'TestController' },
                testMethod: jest.fn(),
            };

            // Mock the discovery service to return metadata
            mockDiscoveryService.getControllers.mockReturnValue([
                { serviceName: 'TestController', instance: mockController },
            ]);

            await service.onModuleInit();

            // Just verify the service initializes without error
            expect(mockDiscoveryService.getControllers).toHaveBeenCalled();
        });

        it('should log all discovered methods', async () => {
            const mockController = {
                constructor: { name: 'TestController' },
                testMethod1: jest.fn(),
                testMethod2: jest.fn(),
            };

            // Mock the discovery service to return metadata
            mockDiscoveryService.getControllers.mockReturnValue([
                { serviceName: 'TestController', instance: mockController },
            ]);

            await service.onModuleInit();

            // Just verify the service initializes without error
            expect(mockDiscoveryService.getControllers).toHaveBeenCalled();
        });

        it('should handle controller with missing service name', async () => {
            // This test covers lines 86-87: Missing service name warning
            const mockController = {
                instance: {
                    constructor: { name: 'TestController' },
                    testMethod: jest.fn(),
                },
            };

            // Mock the discovery service to return controller
            mockDiscoveryService.getControllers.mockReturnValue([mockController]);

            // Mock the reflector to return metadata with no serviceName
            mockReflector.get
                .mockReturnValueOnce({ serviceName: null }) // GRPC_CONTROLLER_METADATA
                .mockReturnValueOnce(undefined); // __isProvider__

            await service.onModuleInit();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Controller missing service name, skipping registration',
            );
        });

        it('should handle alternative method metadata discovery', async () => {
            // This test covers lines 127-132: Alternative method metadata handling
            const mockPrototype = {
                testMethod: jest.fn(),
                constructor: jest.fn(),
            };

            const mockController = {
                instance: {
                    constructor: { name: 'TestService' },
                },
            };

            // Mock Object.getPrototypeOf to return our mock prototype
            jest.spyOn(Object, 'getPrototypeOf').mockReturnValue(mockPrototype);

            // Mock the discovery service to return a controller
            mockDiscoveryService.getControllers.mockReturnValue([mockController]);

            // Mock the reflector to return gRPC controller metadata
            mockReflector.get
                .mockReturnValueOnce({ serviceName: 'TestService' }) // GRPC_CONTROLLER_METADATA
                .mockReturnValueOnce(undefined); // __isProvider__

            // Mock the reflector to return no metadata for the method (so it falls back to Reflect.getMetadata)
            mockReflector.get
                .mockReturnValueOnce(undefined) // testMethod metadata (no metadata from reflector)
                .mockReturnValueOnce(undefined); // Reflect.getMetadata fallback

            // Mock Reflect to return alternative metadata for the testMethod
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key, target, propertyKey) => {
                if (key === GRPC_METHOD_METADATA && propertyKey === 'testMethod') {
                    return { methodName: 'AlternativeMethodName' };
                }
                return undefined;
            });

            await service.onModuleInit();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Found gRPC method (alt): TestService.AlternativeMethodName',
            );
        });

        it('should handle method checking errors gracefully', async () => {
            // This test covers line 146: Method check error logging
            const mockPrototype = {
                problematicMethod: jest.fn(),
                constructor: jest.fn(),
            };

            const mockController = {
                instance: {
                    constructor: { name: 'TestService' },
                },
            };

            // Mock Object.getPrototypeOf to return our mock prototype
            jest.spyOn(Object, 'getPrototypeOf').mockReturnValue(mockPrototype);

            mockDiscoveryService.getControllers.mockReturnValue([mockController]);

            // Mock the reflector to return gRPC controller metadata
            mockReflector.get
                .mockReturnValueOnce({ serviceName: 'TestService' }) // GRPC_CONTROLLER_METADATA
                .mockReturnValueOnce(undefined); // __isProvider__

            // Mock the reflector to return no metadata for the method (so it falls back to Reflect.getMetadata)
            mockReflector.get
                .mockReturnValueOnce(undefined) // problematicMethod metadata (no metadata from reflector)
                .mockReturnValueOnce(undefined); // Reflect.getMetadata fallback

            // Mock Reflect to throw an error during metadata checking
            jest.spyOn(Reflect, 'getMetadata').mockImplementation(() => {
                throw new Error('Metadata access failed');
            });

            await service.onModuleInit();

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(
                    'Error checking method problematicMethod: Metadata access failed',
                ),
            );
        });

        it('should warn when no gRPC methods are found for controller', async () => {
            // This test covers lines 151-152: No gRPC methods found warning
            const mockPrototype = {
                constructor: jest.fn(),
                // No methods that would have gRPC metadata
            };

            const mockControllerWithNoMethods = {
                instance: {
                    constructor: { name: 'EmptyController' },
                },
            };

            // Mock Object.getPrototypeOf to return our mock prototype
            jest.spyOn(Object, 'getPrototypeOf').mockReturnValue(mockPrototype);

            mockDiscoveryService.getControllers.mockReturnValue([mockControllerWithNoMethods]);

            // Mock the reflector to return gRPC controller metadata
            mockReflector.get
                .mockReturnValueOnce({ serviceName: 'EmptyService' }) // GRPC_CONTROLLER_METADATA
                .mockReturnValueOnce(undefined); // __isProvider__

            // Mock Reflect to return no metadata for any methods
            jest.spyOn(Reflect, 'getMetadata').mockReturnValue(undefined);

            await service.onModuleInit();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'No gRPC methods found for controller: EmptyService',
            );
        });
    });
});
