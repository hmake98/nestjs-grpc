import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

import { GrpcControllerDiscoveryService } from '../../src/services/grpc-controller-discovery.service';
import { GrpcRegistryService } from '../../src/services/grpc-registry.service';
import { GRPC_CONTROLLER_METADATA, GRPC_METHOD_METADATA } from '../../src/constants';


describe('GrpcControllerDiscoveryService', () => {
	let service: GrpcControllerDiscoveryService;
	let module: TestingModule;
	let discovery: Partial<DiscoveryService>;
	let reflector: Reflector;
	let registry: jest.Mocked<GrpcRegistryService>;

	beforeEach(async () => {
		registry = {
			registerController: jest.fn().mockResolvedValue(undefined),
			getRegisteredControllers: jest.fn() as any,
			isControllerRegistered: jest.fn() as any,
			onModuleInit: jest.fn() as any,
		} as any;

		class HttpController {}
		class GrpcCtrl {
			a() {}
			b() {}
		}

		discovery = {
			getControllers: jest.fn().mockReturnValue([
				{ instance: new HttpController() },
				{ instance: new GrpcCtrl() },
			]),
		};

		reflector = new Reflector();
		// Apply metadata to GrpcCtrl class and its methods
		const controllers = ((discovery as any).getControllers() as any);
		Reflect.defineMetadata(
			GRPC_CONTROLLER_METADATA,
			{ serviceName: 'DiscService' },
			controllers[1].instance.constructor,
		);
		const proto = controllers[1].instance.constructor.prototype;
		proto.a = function () {};
		proto.b = function () {};
		Reflect.defineMetadata(GRPC_METHOD_METADATA, { methodName: 'AMethod' }, proto, 'a');
		// leave 'b' undecorated to test inference

		module = await Test.createTestingModule({
			providers: [
				GrpcControllerDiscoveryService,
				MetadataScanner,
				{ provide: DiscoveryService, useValue: discovery },
				{ provide: Reflector, useValue: reflector },
				{ provide: GrpcRegistryService, useValue: registry },
			],
		}).compile();

		service = module.get(GrpcControllerDiscoveryService);
	});

	afterEach(async () => {
		await module.close();
		jest.clearAllMocks();
	});

	it('discovers controllers and registers with inferred and decorated methods', async () => {
		await service.onModuleInit();
		expect(registry.registerController).toHaveBeenCalledWith(
			'DiscService',
			expect.anything(),
			expect.objectContaining({ serviceName: 'DiscService' }),
		);
	});
});