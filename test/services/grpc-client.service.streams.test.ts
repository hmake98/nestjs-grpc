import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'events';

import { GrpcClientService } from '../../src/services/grpc-client.service';
import { GrpcProtoService } from '../../src/services/grpc-proto.service';
import { GRPC_OPTIONS } from '../../src/constants';
import type { GrpcOptions } from '../../src/interfaces';


jest.mock('@grpc/grpc-js', () => ({
	credentials: {
		createInsecure: jest.fn().mockReturnValue({}),
		createSsl: jest.fn().mockReturnValue({}),
	},
}));

function createStream() {
	const ee: any = new EventEmitter();
	ee.write = jest.fn();
	ee.end = jest.fn(() => {
		setImmediate(() => ee.emit('end'));
	});
	ee.cancel = jest.fn();
	return ee;
}

describe('GrpcClientService streams and retry', () => {
	let service: GrpcClientService;
	let proto: jest.Mocked<GrpcProtoService>;
	let options: GrpcOptions;

	beforeEach(async () => {
		options = {
			protoPath: '/test.proto',
			package: 'test.package',
			url: 'localhost:50051',
		};

		proto = {
			getProtoDefinition: jest.fn(),
			load: jest.fn(),
			loadService: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GrpcClientService,
				{ provide: GRPC_OPTIONS, useValue: options },
				{ provide: GrpcProtoService, useValue: proto },
			],
		}).compile();

		service = module.get(GrpcClientService);

		// Provide a default service constructor for stream tests
		const ServiceCtor: any = function () {
			(this as any).getUpdates = (_req: any) => createStream();
			(this as any).upload = () => createStream();
			(this as any).chat = () => createStream();
		};
		proto.getProtoDefinition.mockReturnValue({ NotificationService: ServiceCtor, FileService: ServiceCtor, ChatService: ServiceCtor });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('serverStream emits data and handles end', done => {
		const shared = createStream();
		// Override to return shared stream
		proto.getProtoDefinition.mockReturnValueOnce({ NotificationService: function(){ (this as any).getUpdates = () => shared; } as any });

		const data: number[] = [];
		const obs = service.serverStream<any, number>('NotificationService', 'getUpdates', {});
		const sub = obs.subscribe({
			next: v => {
				data.push(v as any);
				if (data.length === 3) {
					try {
						expect(data).toEqual([1, 2, 3]);
						sub.unsubscribe();
						done();
					} catch (e) { done(e); }
				}
			},
			error: err => done(err),
		});

		setImmediate(() => {
			shared.emit('data', 1);
			shared.emit('data', 2);
			shared.emit('data', 3);
			shared.emit('end');
		});
	});

	it('clientStream writes input and resolves on data', async () => {
		const shared = createStream();
		proto.getProtoDefinition.mockReturnValueOnce({ FileService: function(){ (this as any).upload = () => shared; } as any });
		const inputs = [ { a: 1 }, { a: 2 } ];
		const src = {
			subscribe: ({ next, complete }: any) => { inputs.forEach(i => next(i)); complete(); },
		} as any;

		const p = service.clientStream<any, string>('FileService', 'upload', src);
		setImmediate(() => {
			shared.emit('data', 'ok');
			shared.emit('end');
		});
		const result = await p;
		expect(result).toBe('ok');
		expect(shared.write).toHaveBeenCalledTimes(2);
	});

	it('bidiStream forwards responses and ends', done => {
		const shared = createStream();
		proto.getProtoDefinition.mockReturnValueOnce({ ChatService: function(){ (this as any).chat = () => shared; } as any });
		const src = {
			subscribe: ({ next, complete }: any) => { next({ m: 'hi' }); complete(); },
		} as any;
		const obs = service.bidiStream<any, string>('ChatService', 'chat', src);
		const received: string[] = [];
		const sub = obs.subscribe({
			next: v => { received.push(v as any); try { expect(received).toEqual(['pong']); sub.unsubscribe(); done(); } catch(e){ done(e);} },
			error: err => done(err),
		});
		setImmediate(() => { shared.emit('data', 'pong'); shared.emit('end'); });
	});

	it('call retries then succeeds based on backoff', async () => {
		// Spy on private callUnaryMethod to fail twice then succeed
		let attempts = 0;
		jest.spyOn<any, any>(service as any, 'callUnaryMethod').mockImplementation(() => {
			attempts++;
			if (attempts <= 2) {
				return Promise.reject(new Error('fail'));
			}
			return Promise.resolve('done');
		});
		// Provide a minimal service method presence
		const ServiceCtor: any = function () { (this as any).x = () => {}; };
		proto.getProtoDefinition.mockReturnValue({ Svc: ServiceCtor });
		const promise = service.call<any, any>('Svc', 'x', {}, { maxRetries: 2, retryDelay: 1 });
		const res = await promise;
		expect(res).toBe('done');
	});

	it('validateMethod failure throws', async () => {
		proto.getProtoDefinition.mockReturnValue({});
		await expect(service.call<any, any>('MissingSvc', 'x', {})).rejects.toThrow('Method');
	});
});