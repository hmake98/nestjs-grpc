import { Test, TestingModule } from '@nestjs/testing';
import * as grpc from '@grpc/grpc-js';

import { GrpcProviderService } from '../../src/services/grpc-provider.service';
import { GrpcProtoService } from '../../src/services/grpc-proto.service';
import { GRPC_OPTIONS } from '../../src/constants';
import type { GrpcOptions, ControllerMetadata } from '../../src/interfaces';

jest.mock('@grpc/grpc-js', () => {
	const serverInstance = {
		bindAsync: jest.fn(),
		addService: jest.fn(),
		tryShutdown: jest.fn(),
		forceShutdown: jest.fn(),
		start: jest.fn(),
	};
	const Server = jest.fn().mockImplementation(() => serverInstance);
	return {
		Server,
		ServerCredentials: {
			createInsecure: jest.fn().mockReturnValue({}),
			createSsl: jest.fn().mockReturnValue({}),
		},
		status: { INTERNAL: 13 },
		__serverInstance: serverInstance,
	};
});


describe('GrpcProviderService', () => {
	let service: GrpcProviderService;
	let module: TestingModule;
	let mockProtoService: any;
	let mockOptions: GrpcOptions;
	let serverInstance: any;

	beforeEach(async () => {
		mockOptions = {
			protoPath: '/path/to/service.proto',
			package: 'test.package',
			url: 'localhost:50051',
			secure: false,
		};

		mockProtoService = {
			getProtoDefinition: jest.fn(),
			load: jest.fn().mockResolvedValue({}),
		};

		module = await Test.createTestingModule({
			providers: [
				GrpcProviderService,
				{ provide: GRPC_OPTIONS, useValue: mockOptions },
				{ provide: GrpcProtoService, useValue: mockProtoService },
			],
		}).compile();

		service = module.get(GrpcProviderService);

		// Access the shared mock server instance
		serverInstance = (grpc as any).__serverInstance;
	});

	afterEach(async () => {
		// Ensure server does not hang during module.close()
		try {
			serverInstance.tryShutdown.mockImplementation((cb: any) => cb());
		} catch {}
		await module.close();
		jest.clearAllMocks();
	});

	it('starts server on module init and registers pending controllers', async () => {
		// Arrange bindAsync success and track start flag by spying start method via server object
		serverInstance.bindAsync.mockImplementation((_url: string, _cred: any, cb: any) => cb(null, 50051));
		// Ensure addService will be called via registration
		const controllerMeta: ControllerMetadata = {
			serviceName: 'TestService',
			package: 'test.package',
			methods: new Map([['Ping', { originalMethodName: 'ping', methodName: 'Ping' }]]),
		};
		// Make proto definition include a service constructor shape with .service
		const serviceConstructor: any = function () {};
		serviceConstructor.service = { originalName: { Ping: 'Ping' } };
		mockProtoService.getProtoDefinition.mockReturnValue({ TestService: serviceConstructor });

		// Pre-register a controller before server starts
		await service.registerController('TestService', { ping: jest.fn() }, controllerMeta);

		// Act
		serverInstance.bindAsync.mockImplementation((_url: string, _cred: any, cb: any) => {
			// Resolve immediately
			cb(null, 50051);
		});
		await service.onModuleInit();

		// Assert
		expect(serverInstance.bindAsync).toHaveBeenCalled();
		expect(serverInstance.addService).toHaveBeenCalled();
		expect(service.isServerRunning()).toBe(true);
	});

	it('handles bind errors', async () => {
		serverInstance.bindAsync.mockImplementation((_url: string, _cred: any, cb: any) => cb(new Error('bind fail')));
		await expect(service.onModuleInit()).rejects.toThrow('Failed to bind server');
	});

	it('stops server on destroy', async () => {
		serverInstance.bindAsync.mockImplementation((_url: string, _cred: any, cb: any) => cb(null, 50051));
		serverInstance.tryShutdown.mockImplementation((cb: any) => cb());
		await service.onModuleInit();
		await service.onModuleDestroy();
		expect(serverInstance.tryShutdown).toHaveBeenCalled();
		expect(service.isServerRunning()).toBe(false);
	});

	it('force shutdown on shutdown error', async () => {
		serverInstance.bindAsync.mockImplementation((_url: string, _cred: any, cb: any) => cb(null, 50051));
		serverInstance.tryShutdown.mockImplementation((cb: any) => cb(new Error('fail')));
		await service.onModuleInit();
		await service.onModuleDestroy();
		expect(serverInstance.forceShutdown).toHaveBeenCalled();
	});

	it('createServer creates server with message size options', async () => {
		// Recreate service with size options
		// Avoid long shutdown time since we never started
		await module.close();
		mockOptions = { ...mockOptions, maxSendMessageSize: 1024, maxReceiveMessageSize: 2048 } as any;
		module = await Test.createTestingModule({
			providers: [
				GrpcProviderService,
				{ provide: GRPC_OPTIONS, useValue: mockOptions },
				{ provide: GrpcProtoService, useValue: mockProtoService },
			],
		}).compile();
		service = module.get(GrpcProviderService);
		serverInstance = (grpc as any).__serverInstance;
		// Trigger server creation path
		serverInstance.bindAsync.mockImplementation((_url: string, _cred: any, cb: any) => cb(null, 50051));
		await service.onModuleInit();
		// Constructor called with options
		expect(((grpc as any).Server as jest.Mock)).toHaveBeenCalledWith({
			'grpc.max_send_message_length': 1024,
			'grpc.max_receive_message_length': 2048,
		});
	});

	it('createServerCredentials returns insecure for non-secure config', () => {
		const creds = (service as any).createServerCredentials();
		expect(grpc.ServerCredentials.createInsecure).toHaveBeenCalled();
		expect(creds).toBeDefined();
	});

	it('createServerCredentials throws when secure without certs', async () => {
		await module.close();
		mockOptions = { ...mockOptions, secure: true } as any;
		module = await Test.createTestingModule({
			providers: [
				GrpcProviderService,
				{ provide: GRPC_OPTIONS, useValue: mockOptions },
				{ provide: GrpcProtoService, useValue: mockProtoService },
			],
		}).compile();
		service = module.get(GrpcProviderService);
		expect(() => (service as any).createServerCredentials()).toThrow('Private key and certificate chain are required');
	});

	it('validateMethods maps methods and registers service', async () => {
		serverInstance.bindAsync.mockImplementation((_url: string, _cred: any, cb: any) => cb(null, 50051));
		const controllerMeta: ControllerMetadata = {
			serviceName: 'EchoService',
			methods: new Map([
				['Echo', { originalMethodName: 'echo', methodName: 'Echo' }],
				['Missing', { originalMethodName: 'missing', methodName: 'Missing' }],
			]),
		};
		const svcCtor: any = function () {};
		svcCtor.service = { originalName: { Echo: 'Echo' } };
		mockProtoService.getProtoDefinition.mockReturnValue({ EchoService: svcCtor });
		await service.registerController('EchoService', { echo: jest.fn() }, controllerMeta);
		await service.onModuleInit();
		expect(serverInstance.addService).toHaveBeenCalled();
	});
});