import { Test, TestingModule } from '@nestjs/testing';

import { GrpcRegistryService } from '../../src/services/grpc-registry.service';
import { GrpcProviderService } from '../../src/services/grpc-provider.service';


describe('GrpcRegistryService', () => {
	let service: GrpcRegistryService;
	let module: TestingModule;
	let provider: jest.Mocked<GrpcProviderService>;

	beforeEach(async () => {
		provider = {
			registerController: jest.fn().mockResolvedValue(undefined),
			isServerRunning: jest.fn().mockReturnValue(true),
			getServer: jest.fn(),
		} as any;

		module = await Test.createTestingModule({
			providers: [GrpcRegistryService, { provide: GrpcProviderService, useValue: provider }],
		}).compile();
		service = module.get(GrpcRegistryService);
	});

	afterEach(async () => {
		await module.close();
		jest.clearAllMocks();
	});

	it('queues and registers controller via provider', async () => {
		await service.registerController(
			'MyService',
			{ instance: true },
			{ serviceName: 'MyService', methods: new Map() } as any,
		);
		expect(provider.registerController).toHaveBeenCalled();
		expect(service.isControllerRegistered('MyService')).toBe(true);
		const all = service.getRegisteredControllers();
		expect(all.has('MyService')).toBe(true);
	});

	it('processes pending registrations on init', async () => {
		// Spy on internal process method via onModuleInit path
		await expect(service.onModuleInit()).resolves.toBeUndefined();
	});
});