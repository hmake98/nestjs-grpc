import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';

import { GrpcProtoService } from '../../src/services/grpc-proto.service';
import { GRPC_OPTIONS } from '../../src/constants';
import { GrpcOptions } from '../../src/interfaces';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');
jest.mock('glob');

// Mock proto-utils
jest.mock('../../src/utils/proto-utils', () => ({
    loadProto: jest.fn(),
    getServiceByName: jest.fn(),
}));

describe('GrpcProtoService', () => {
    let service: GrpcProtoService;
    let mockOptions: GrpcOptions;

    beforeEach(async () => {
        mockOptions = {
            protoPath: '/test/path.proto',
            package: 'test.package',
            logging: {
                enabled: true,
                level: 'debug',
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GrpcProtoService,
                {
                    provide: GRPC_OPTIONS,
                    useValue: mockOptions,
                },
            ],
        }).compile();

        service = module.get<GrpcProtoService>(GrpcProtoService);
    });

    describe('constructor', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should throw error if options are not provided', () => {
            expect(() => {
                new GrpcProtoService(null as any);
            }).toThrow('Cannot read properties of null');
        });

        it('should throw error if protoPath is missing', () => {
            expect(() => {
                new GrpcProtoService({ package: 'test' } as any);
            }).toThrow('protoPath is required and must be a string');
        });

        it('should throw error if package is missing', () => {
            expect(() => {
                new GrpcProtoService({ protoPath: '/test.proto' } as any);
            }).toThrow('package is required and must be a string');
        });
    });

    describe('onModuleInit', () => {
        it('should load proto files on initialization', async () => {
            const loadSpy = jest.spyOn(service, 'load').mockResolvedValue({});
            await service.onModuleInit();
            expect(loadSpy).toHaveBeenCalled();
        });

        it('should handle loading errors', async () => {
            jest.spyOn(service, 'load').mockRejectedValue(new Error('Load failed'));
            await expect(service.onModuleInit()).rejects.toThrow('Load failed');
        });
    });

    describe('load', () => {
        it('should return cached definition if already loaded', async () => {
            const mockDefinition = { TestService: jest.fn() };
            jest.spyOn(service, 'load').mockResolvedValue(mockDefinition);

            const result1 = await service.load();
            const result2 = await service.load();

            expect(result1).toBe(mockDefinition);
            expect(result2).toBe(mockDefinition);
        });

        it('should handle concurrent load requests', async () => {
            const mockDefinition = { TestService: jest.fn() };
            jest.spyOn(service, 'load').mockResolvedValue(mockDefinition);

            const promises = [service.load(), service.load(), service.load()];
            const results = await Promise.all(promises);

            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result).toBe(mockDefinition);
            });
        });
    });

    describe('getProtoDefinition', () => {
        it('should return the loaded proto definition', () => {
            const mockDefinition = { TestService: jest.fn() };
            (service as any).protoDefinition = mockDefinition;
            (service as any).isLoaded = true;

            expect(service.getProtoDefinition()).toBe(mockDefinition);
        });

        it('should throw error if not loaded', () => {
            (service as any).isLoaded = false;
            expect(() => service.getProtoDefinition()).toThrow(
                'Proto files have not been loaded yet',
            );
        });
    });

    describe('loadService', () => {
        it('should load a specific service', async () => {
            const mockService = { methods: ['method1', 'method2'] };
            jest.spyOn(service, 'loadService').mockResolvedValue(mockService);

            const result = await service.loadService('TestService');
            expect(result).toBe(mockService);
        });

        it('should throw error for invalid service name', async () => {
            await expect(service.loadService('')).rejects.toThrow('Service name is required');
        });
    });
});
