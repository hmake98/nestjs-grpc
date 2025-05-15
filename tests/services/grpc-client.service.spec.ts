import { Test } from '@nestjs/testing';
import { GrpcClientFactory } from '../../services/grpc-client.service';
import { ProtoLoaderService } from '../../services/proto-loader.service';
import { GRPC_OPTIONS } from '../../constants';
import { join } from 'path';
import * as grpc from '@grpc/grpc-js';

jest.mock('../../src/services/proto-loader.service');

describe('GrpcClientFactory', () => {
    let grpcClientFactory: GrpcClientFactory;
    let protoLoaderService: ProtoLoaderService;

    const mockGrpcOptions = {
        protoPath: join(__dirname, '../fixtures/test.proto'),
        package: 'test',
        url: 'localhost:5000',
    };

    const mockService = jest.fn();
    const mockClient = {
        testMethod: jest.fn(),
    };

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                GrpcClientFactory,
                ProtoLoaderService,
                {
                    provide: GRPC_OPTIONS,
                    useValue: mockGrpcOptions,
                },
            ],
        }).compile();

        grpcClientFactory = module.get<GrpcClientFactory>(GrpcClientFactory);
        protoLoaderService = module.get<ProtoLoaderService>(ProtoLoaderService);

        // Mock the getProtoDefinition method
        jest.spyOn(protoLoaderService, 'getProtoDefinition').mockReturnValue({
            TestService: mockService,
        });

        // Mock the service constructor
        mockService.mockImplementation(() => mockClient);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a gRPC client', () => {
            const client = grpcClientFactory.create<typeof mockClient>('TestService');

            expect(client).toBeDefined();
            expect(mockService).toHaveBeenCalled();
        });

        it('should reuse the same client for the same service', () => {
            const client1 = grpcClientFactory.create<typeof mockClient>('TestService');
            const client2 = grpcClientFactory.create<typeof mockClient>('TestService');

            expect(client1).toBe(client2);
            expect(mockService).toHaveBeenCalledTimes(1);
        });

        it('should create a new client for different URLs', () => {
            const client1 = grpcClientFactory.create<typeof mockClient>('TestService');
            const client2 = grpcClientFactory.create<typeof mockClient>('TestService', {
                url: 'localhost:5001',
            });

            expect(client1).not.toBe(client2);
            expect(mockService).toHaveBeenCalledTimes(2);
        });

        it('should throw error if service is not found', () => {
            jest.spyOn(protoLoaderService, 'getProtoDefinition').mockReturnValue({});

            expect(() => {
                grpcClientFactory.create('NonExistentService');
            }).toThrow();
        });
    });

    describe('client method wrapping', () => {
        it('should wrap unary methods to return Promises', async () => {
            mockClient.testMethod.mockImplementation((request, metadata, options, callback) => {
                callback(null, { result: 'success' });
                return { cancel: jest.fn() };
            });

            // Create client with wrapped methods
            const client = grpcClientFactory.create<any>('TestService');

            // Call the method
            const result = await client.testMethod({ id: '123' });

            expect(result).toEqual({ result: 'success' });
            expect(mockClient.testMethod).toHaveBeenCalled();
        });

        it('should handle errors in unary methods', async () => {
            const mockError = new Error('Test error');
            mockClient.testMethod.mockImplementation((request, metadata, options, callback) => {
                callback(mockError, null);
                return { cancel: jest.fn() };
            });

            const client = grpcClientFactory.create<any>('TestService');

            await expect(client.testMethod({ id: '123' })).rejects.toThrow('Test error');
        });
    });
});
