import { Test, TestingModule } from '@nestjs/testing';
import { GrpcRegistryService } from '../../src/services/grpc-registry.service';
import { GrpcProviderService } from '../../src/services/grpc-provider.service';
import { ControllerMetadata } from '../../src/interfaces';

describe('GrpcRegistryService', () => {
    let service: GrpcRegistryService;
    let providerService: jest.Mocked<GrpcProviderService>;

    const mockControllerMetadata: ControllerMetadata = {
        serviceName: 'TestService',
        package: 'test',
        methods: new Map([['TestMethod', { methodName: 'TestMethod' }]]),
    };

    const mockController = {
        testMethod: jest.fn(),
    };

    beforeEach(async () => {
        providerService = {
            registerController: jest.fn(),
            isServerRunning: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GrpcRegistryService,
                { provide: GrpcProviderService, useValue: providerService },
            ],
        }).compile();

        service = module.get<GrpcRegistryService>(GrpcRegistryService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });
    });

    describe('onModuleInit', () => {
        it('should process pending registrations', async () => {
            // First register a controller (this will be pending)
            await service.registerController('TestService', mockController, mockControllerMetadata);

            // Reset the mock to track onModuleInit calls
            providerService.registerController.mockClear();

            // Now call onModuleInit
            await service.onModuleInit();

            // Should call registerController again during processing
            expect(providerService.registerController).toHaveBeenCalledWith(
                'TestService',
                mockController,
                mockControllerMetadata,
            );
        });

        it('should handle empty pending registrations', async () => {
            await service.onModuleInit();
            // Should not fail
            expect(service).toBeDefined();
        });
    });

    describe('registerController', () => {
        it('should register controller successfully', () => {
            providerService.registerController.mockReturnValue(undefined);

            service.registerController('TestService', mockController, mockControllerMetadata);

            expect(providerService.registerController).toHaveBeenCalledWith(
                'TestService',
                mockController,
                mockControllerMetadata,
            );
        });

        it('should store controller in pending registrations', () => {
            providerService.registerController.mockReturnValue(undefined);

            service.registerController('TestService', mockController, mockControllerMetadata);

            const registered = service.getRegisteredControllers();
            expect(registered.has('TestService')).toBe(true);
            expect(registered.get('TestService')).toEqual({
                instance: mockController,
                metadata: mockControllerMetadata,
            });
        });

        it('should handle registration errors', () => {
            const error = new Error('Registration failed');
            providerService.registerController.mockImplementation(() => {
                throw error;
            });

            expect(() => {
                service.registerController('TestService', mockController, mockControllerMetadata);
            }).toThrow('Registration failed');
        });

        it('should still store controller even if registration fails', () => {
            const error = new Error('Registration failed');
            providerService.registerController.mockImplementation(() => {
                throw error;
            });

            try {
                service.registerController('TestService', mockController, mockControllerMetadata);
            } catch (e) {
                // Expected to throw
            }

            const registered = service.getRegisteredControllers();
            expect(registered.has('TestService')).toBe(true);
        });
    });

    describe('getRegisteredControllers', () => {
        it('should return empty map initially', () => {
            const registered = service.getRegisteredControllers();
            expect(registered.size).toBe(0);
        });

        it('should return registered controllers', () => {
            providerService.registerController.mockReturnValue(undefined);

            service.registerController('TestService', mockController, mockControllerMetadata);

            const registered = service.getRegisteredControllers();
            expect(registered.size).toBe(1);
            expect(registered.has('TestService')).toBe(true);
        });

        it('should return a copy of registrations', () => {
            providerService.registerController.mockReturnValue(undefined);

            service.registerController('TestService', mockController, mockControllerMetadata);

            const registered1 = service.getRegisteredControllers();
            const registered2 = service.getRegisteredControllers();

            expect(registered1).not.toBe(registered2); // Different instances
            expect(registered1).toEqual(registered2); // Same content
        });
    });

    describe('isControllerRegistered', () => {
        it('should return false for unregistered controller', () => {
            expect(service.isControllerRegistered('TestService')).toBe(false);
        });

        it('should return true for registered controller', () => {
            providerService.registerController.mockReturnValue(undefined);

            service.registerController('TestService', mockController, mockControllerMetadata);

            expect(service.isControllerRegistered('TestService')).toBe(true);
        });
    });

    describe('processPendingRegistrations', () => {
        it('should process multiple pending registrations', () => {
            const controller2 = { method2: jest.fn() };
            const metadata2: ControllerMetadata = {
                serviceName: 'TestService2',
                package: 'test',
                methods: new Map([['TestMethod2', { methodName: 'TestMethod2' }]]),
            };

            // Register multiple controllers
            service.registerController('TestService1', mockController, mockControllerMetadata);
            service.registerController('TestService2', controller2, metadata2);

            // Clear the mock to track only the onModuleInit processing
            providerService.registerController.mockClear();

            service.onModuleInit();

            expect(providerService.registerController).toHaveBeenCalledTimes(2);
        });

        it('should handle registration errors during processing', () => {
            // First call succeeds (during registerController)
            providerService.registerController.mockReturnValueOnce(undefined);

            service.registerController('TestService', mockController, mockControllerMetadata);

            // Second call fails (during onModuleInit processing)
            providerService.registerController.mockImplementationOnce(() => {
                throw new Error('Processing failed');
            });

            // Should not throw
            service.onModuleInit();

            expect(providerService.registerController).toHaveBeenCalledTimes(2);
        });

        it('should not process if already processing', () => {
            service.registerController('TestService', mockController, mockControllerMetadata);

            // First call processes the pending registrations
            service.onModuleInit();

            // Second call should not process anything since pending registrations are cleared
            service.onModuleInit();

            // Should only register once during processing (plus the initial registration)
            expect(providerService.registerController).toHaveBeenCalledTimes(2);
        });

        it('should handle multiple controllers with mixed success/failure', () => {
            const controller2 = { method2: jest.fn() };
            const metadata2: ControllerMetadata = {
                serviceName: 'TestService2',
                package: 'test',
                methods: new Map([['TestMethod2', { methodName: 'TestMethod2' }]]),
            };

            // Register controllers (these should succeed)
            providerService.registerController.mockReturnValue(undefined);
            service.registerController('TestService1', mockController, mockControllerMetadata);
            service.registerController('TestService2', controller2, metadata2);

            // Setup mixed responses for processing
            providerService.registerController
                .mockClear()
                .mockReturnValueOnce(undefined) // First succeeds
                .mockImplementationOnce(() => {
                    throw new Error('Second fails');
                }); // Second fails

            service.onModuleInit();

            expect(providerService.registerController).toHaveBeenCalledTimes(2);
        });
    });

    describe('waitForProviderReady', () => {
        it('should return immediately when provider is ready', async () => {
            providerService.isServerRunning.mockReturnValue(true);

            const startTime = Date.now();
            await (service as any).waitForProviderReady();
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(50); // Should be very quick
            expect(providerService.isServerRunning).toHaveBeenCalled();
        });

        it('should wait and retry when provider is not ready initially', async () => {
            // Mock setTimeout to resolve immediately for testing
            const originalSetTimeout = global.setTimeout;
            (global as any).setTimeout = jest.fn((callback: any) => {
                callback();
                return 1 as any;
            });

            try {
                providerService.isServerRunning
                    .mockReturnValueOnce(false) // First check fails
                    .mockReturnValueOnce(false) // Second check fails
                    .mockReturnValueOnce(true); // Third check succeeds

                await (service as any).waitForProviderReady();

                expect(providerService.isServerRunning).toHaveBeenCalledTimes(3);
            } finally {
                (global as any).setTimeout = originalSetTimeout;
            }
        });

        it('should timeout after maximum attempts', async () => {
            // Mock setTimeout to resolve immediately for testing
            const originalSetTimeout = global.setTimeout;
            (global as any).setTimeout = jest.fn((callback: any) => {
                callback();
                return 1 as any;
            });

            try {
                providerService.isServerRunning.mockReturnValue(false);

                await (service as any).waitForProviderReady();

                // Since we're mocking setTimeout to resolve immediately, the timing test is not valid
                // Instead, verify that the method was called the expected number of times
                expect(providerService.isServerRunning).toHaveBeenCalledTimes(10); // maxAttempts
            } finally {
                (global as any).setTimeout = originalSetTimeout;
            }
        });
    });
});
