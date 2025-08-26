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
        methods: new Map([
            ['TestMethod', { methodName: 'TestMethod' }],
        ]),
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
                mockControllerMetadata
            );
        });

        it('should handle empty pending registrations', async () => {
            await service.onModuleInit();
            // Should not fail
            expect(service).toBeDefined();
        });
    });

    describe('registerController', () => {
        it('should register controller successfully', async () => {
            providerService.registerController.mockResolvedValue();

            await service.registerController('TestService', mockController, mockControllerMetadata);

            expect(providerService.registerController).toHaveBeenCalledWith(
                'TestService',
                mockController,
                mockControllerMetadata
            );
        });

        it('should store controller in pending registrations', async () => {
            providerService.registerController.mockResolvedValue();

            await service.registerController('TestService', mockController, mockControllerMetadata);

            const registered = service.getRegisteredControllers();
            expect(registered.has('TestService')).toBe(true);
            expect(registered.get('TestService')).toEqual({
                instance: mockController,
                metadata: mockControllerMetadata,
            });
        });

        it('should handle registration errors', async () => {
            const error = new Error('Registration failed');
            providerService.registerController.mockRejectedValue(error);

            await expect(
                service.registerController('TestService', mockController, mockControllerMetadata)
            ).rejects.toThrow('Registration failed');
        });

        it('should still store controller even if registration fails', async () => {
            const error = new Error('Registration failed');
            providerService.registerController.mockRejectedValue(error);

            try {
                await service.registerController('TestService', mockController, mockControllerMetadata);
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

        it('should return registered controllers', async () => {
            providerService.registerController.mockResolvedValue();

            await service.registerController('TestService', mockController, mockControllerMetadata);

            const registered = service.getRegisteredControllers();
            expect(registered.size).toBe(1);
            expect(registered.has('TestService')).toBe(true);
        });

        it('should return a copy of registrations', async () => {
            providerService.registerController.mockResolvedValue();

            await service.registerController('TestService', mockController, mockControllerMetadata);

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

        it('should return true for registered controller', async () => {
            providerService.registerController.mockResolvedValue();

            await service.registerController('TestService', mockController, mockControllerMetadata);

            expect(service.isControllerRegistered('TestService')).toBe(true);
        });
    });

    describe('processPendingRegistrations', () => {
        it('should process multiple pending registrations', async () => {
            const controller2 = { method2: jest.fn() };
            const metadata2: ControllerMetadata = {
                serviceName: 'TestService2',
                package: 'test',
                methods: new Map([['TestMethod2', { methodName: 'TestMethod2' }]]),
            };

            // Register multiple controllers
            await service.registerController('TestService1', mockController, mockControllerMetadata);
            await service.registerController('TestService2', controller2, metadata2);

            // Clear the mock to track only the onModuleInit processing
            providerService.registerController.mockClear();

            await service.onModuleInit();

            expect(providerService.registerController).toHaveBeenCalledTimes(2);
        });

        it('should handle registration errors during processing', async () => {
            // First call succeeds (during registerController)
            providerService.registerController.mockResolvedValueOnce();

            await service.registerController('TestService', mockController, mockControllerMetadata);

            // Second call fails (during onModuleInit processing)
            providerService.registerController.mockRejectedValueOnce(new Error('Processing failed'));

            // Should not throw
            await service.onModuleInit();

            expect(providerService.registerController).toHaveBeenCalledTimes(2);
        });

        it('should not process if already processing', async () => {
            await service.registerController('TestService', mockController, mockControllerMetadata);

            // Simulate concurrent calls to onModuleInit
            const promise1 = service.onModuleInit();
            const promise2 = service.onModuleInit();

            await Promise.all([promise1, promise2]);

            // Should only register once during processing (plus the initial registration)
            expect(providerService.registerController).toHaveBeenCalledTimes(2);
        });

        it('should handle multiple controllers with mixed success/failure', async () => {
            const controller2 = { method2: jest.fn() };
            const metadata2: ControllerMetadata = {
                serviceName: 'TestService2',
                package: 'test',
                methods: new Map([['TestMethod2', { methodName: 'TestMethod2' }]]),
            };

            // Register controllers (these should succeed)
            providerService.registerController.mockResolvedValue();
            await service.registerController('TestService1', mockController, mockControllerMetadata);
            await service.registerController('TestService2', controller2, metadata2);

            // Setup mixed responses for processing
            providerService.registerController
                .mockClear()
                .mockResolvedValueOnce() // First succeeds
                .mockRejectedValueOnce(new Error('Second fails')); // Second fails

            await service.onModuleInit();

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
            providerService.isServerRunning
                .mockReturnValueOnce(false) // First check fails
                .mockReturnValueOnce(false) // Second check fails
                .mockReturnValueOnce(true); // Third check succeeds

            await (service as any).waitForProviderReady();

            expect(providerService.isServerRunning).toHaveBeenCalledTimes(3);
        });

        it('should timeout after maximum attempts', async () => {
            providerService.isServerRunning.mockReturnValue(false);

            const startTime = Date.now();
            await (service as any).waitForProviderReady();
            const endTime = Date.now();

            // Should wait for at least some time
            expect(endTime - startTime).toBeGreaterThan(100);
            expect(providerService.isServerRunning).toHaveBeenCalledTimes(10); // maxAttempts
        });
    });
});