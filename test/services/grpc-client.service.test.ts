import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';

import { GrpcClientService } from '../../src/services/grpc-client.service';
import { ProtoLoaderService } from '../../src/services/proto-loader.service';
import { GrpcLogger } from '../../src/utils/logger';
import { GRPC_OPTIONS } from '../../src/constants';
import { GrpcOptions } from '../../src/interfaces';

// Mock @grpc/grpc-js
jest.mock('@grpc/grpc-js', () => ({
    credentials: {
        createInsecure: jest.fn(),
        createSsl: jest.fn(),
    },
    Metadata: jest.fn(),
}));

// Mock proto-utils
jest.mock('../../src/utils/proto-utils', () => ({
    createClientCredentials: jest.fn(),
    createChannelOptions: jest.fn(),
    getServiceMethods: jest.fn(),
}));

describe('GrpcClientService', () => {
    let service: GrpcClientService;
    let mockProtoLoaderService: jest.Mocked<ProtoLoaderService>;
    let mockOptions: GrpcOptions;

    beforeEach(async () => {
        const mockLogger = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            child: jest.fn().mockReturnThis(),
        } as any;

        mockProtoLoaderService = {
            getProtoDefinition: jest.fn(),
            isLoaded: jest.fn(),
            loadProtoFile: jest.fn(),
        } as any;

        mockOptions = {
            package: 'test.package',
            protoPath: '/path/to/test.proto',
            url: 'localhost:50051',
            logging: {
                enabled: true,
                level: 'debug',
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GrpcClientService,
                {
                    provide: GRPC_OPTIONS,
                    useValue: mockOptions,
                },
                {
                    provide: ProtoLoaderService,
                    useValue: mockProtoLoaderService,
                },
                {
                    provide: GrpcLogger,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<GrpcClientService>(GrpcClientService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should throw error if options are not provided', () => {
            expect(() => {
                new GrpcClientService(null as any, mockProtoLoaderService);
            }).toThrow();
        });
    });

    describe('onModuleInit', () => {
        it('should initialize cleanup interval', () => {
            jest.spyOn(global, 'setInterval');
            service.onModuleInit();
            expect(setInterval).toHaveBeenCalled();
        });
    });

    describe('onModuleDestroy', () => {
        it('should cleanup resources', () => {
            jest.spyOn(global, 'clearInterval');
            service.onModuleInit(); // Initialize first
            service.onModuleDestroy();
            expect(clearInterval).toHaveBeenCalled();
        });
    });

    describe('getAvailableServices', () => {
        it('should return available services', () => {
            const mockProtoDefinition = {
                TestService: jest.fn(),
                AnotherService: jest.fn(),
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const services = service.getAvailableServices();

            expect(services).toContain('TestService');
            expect(services).toContain('AnotherService');
        });

        it('should return empty array if no proto definition', () => {
            mockProtoLoaderService.getProtoDefinition.mockReturnValue(null);

            const services = service.getAvailableServices();

            expect(services).toEqual([]);
        });

        it('should handle errors gracefully', () => {
            mockProtoLoaderService.getProtoDefinition.mockImplementation(() => {
                throw new Error('Proto not loaded');
            });

            const services = service.getAvailableServices();

            expect(services).toEqual([]);
        });
    });

    describe('hasService', () => {
        it('should return true for existing service', () => {
            const mockProtoDefinition = {
                TestService: jest.fn(),
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const hasService = service.hasService('TestService');

            expect(hasService).toBe(true);
        });

        it('should return false for non-existing service', () => {
            const mockProtoDefinition = {
                TestService: jest.fn(),
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const hasService = service.hasService('NonExistentService');

            expect(hasService).toBe(false);
        });
    });

    describe('create', () => {
        it('should create a client for a service', () => {
            const mockServiceConstructor = jest.fn().mockReturnValue({
                testMethod: jest.fn(),
            });

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const {
                createClientCredentials,
                createChannelOptions,
                getServiceMethods,
            } = require('../../src/utils/proto-utils');

            createClientCredentials.mockReturnValue({});
            createChannelOptions.mockReturnValue({});
            getServiceMethods.mockReturnValue(['testMethod']);

            const client = service.create('TestService');

            expect(client).toBeDefined();
            expect(mockServiceConstructor).toHaveBeenCalled();
        });

        it('should throw error for invalid service name', () => {
            expect(() => service.create('')).toThrow(
                'Service name is required and must be a string',
            );
            expect(() => service.create(null as any)).toThrow(
                'Service name is required and must be a string',
            );
        });

        it('should throw error for non-existent service', () => {
            mockProtoLoaderService.getProtoDefinition.mockReturnValue({});

            expect(() => service.create('NonExistentService')).toThrow('Service lookup failed');
        });

        it('should use cached client for same service and options', () => {
            const mockServiceConstructor = jest.fn().mockReturnValue({
                testMethod: jest.fn(),
            });

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const {
                createClientCredentials,
                createChannelOptions,
                getServiceMethods,
            } = require('../../src/utils/proto-utils');

            createClientCredentials.mockReturnValue({});
            createChannelOptions.mockReturnValue({});
            getServiceMethods.mockReturnValue(['testMethod']);

            const client1 = service.create('TestService');
            const client2 = service.create('TestService');

            expect(client1).toBe(client2);
            expect(mockServiceConstructor).toHaveBeenCalledTimes(1);
        });
    });

    describe('createClientForService', () => {
        it('should create client for service with options', () => {
            const mockServiceConstructor = jest.fn().mockReturnValue({
                testMethod: jest.fn(),
            });

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const {
                createClientCredentials,
                createChannelOptions,
                getServiceMethods,
            } = require('../../src/utils/proto-utils');

            createClientCredentials.mockReturnValue({});
            createChannelOptions.mockReturnValue({});
            getServiceMethods.mockReturnValue(['testMethod']);

            const options = { timeout: 5000 };
            const client = service.createClientForService('TestService', options);

            expect(client).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should handle service constructor errors', () => {
            const mockServiceConstructor = jest.fn().mockImplementation(() => {
                throw new Error('Constructor failed');
            });

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const {
                createClientCredentials,
                createChannelOptions,
                getServiceMethods,
            } = require('../../src/utils/proto-utils');

            createClientCredentials.mockReturnValue({});
            createChannelOptions.mockReturnValue({});
            getServiceMethods.mockReturnValue(['testMethod']);

            expect(() => service.create('TestService')).toThrow('Client creation failed');
        });

        it('should handle proto loader errors', () => {
            mockProtoLoaderService.getProtoDefinition.mockImplementation(() => {
                throw new Error('Proto not loaded');
            });

            expect(() => service.create('TestService')).toThrow('Service lookup failed');
        });
    });
});
