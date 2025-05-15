import { Test } from '@nestjs/testing';
import { ProtoLoaderService } from '../../src/services/proto-loader.service';
import { GRPC_OPTIONS } from '../../src/constants';
import { join } from 'path';
import * as fs from 'fs';
import * as protoLoader from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';

jest.mock('fs');
jest.mock('@grpc/proto-loader');
jest.mock('@grpc/grpc-js');
jest.mock('glob');

describe('ProtoLoaderService', () => {
    let protoLoaderService: ProtoLoaderService;

    const mockGrpcOptions = {
        protoPath: join(__dirname, '../fixtures/test.proto'),
        package: 'test',
    };

    const mockPackageDefinition = {
        test: {
            TestService: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                ProtoLoaderService,
                {
                    provide: GRPC_OPTIONS,
                    useValue: mockGrpcOptions,
                },
            ],
        }).compile();

        protoLoaderService = module.get<ProtoLoaderService>(ProtoLoaderService);

        // Mock fs.statSync
        (fs.statSync as jest.Mock).mockReturnValue({
            isDirectory: () => false,
        });

        // Mock fs.existsSync
        (fs.existsSync as jest.Mock).mockReturnValue(true);

        // Mock protoLoader.load
        (protoLoader.load as jest.Mock).mockResolvedValue({});

        // Mock grpc.loadPackageDefinition
        (grpc.loadPackageDefinition as jest.Mock).mockReturnValue(mockPackageDefinition);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('load', () => {
        it('should load proto file and return package definition', async () => {
            const result = await protoLoaderService.load();

            expect(result).toEqual(mockPackageDefinition);
            expect(fs.existsSync).toHaveBeenCalled();
            expect(protoLoader.load).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
            expect(grpc.loadPackageDefinition).toHaveBeenCalled();
        });

        it('should throw error if proto file not found', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            await expect(protoLoaderService.load()).rejects.toThrow('Proto file not found');
        });

        it('should handle package filtering', async () => {
            // Mock nested package structure
            const nestedPackage = {
                nested: {
                    service: jest.fn(),
                },
            };

            (grpc.loadPackageDefinition as jest.Mock).mockReturnValue(nestedPackage);

            // Set service with nested package
            const options = { ...mockGrpcOptions, package: 'nested' };
            const moduleWithNested = await Test.createTestingModule({
                providers: [
                    ProtoLoaderService,
                    {
                        provide: GRPC_OPTIONS,
                        useValue: options,
                    },
                ],
            }).compile();

            const service = moduleWithNested.get<ProtoLoaderService>(ProtoLoaderService);

            const result = await service.load();
            expect(result).toEqual(nestedPackage.nested);
        });
    });

    describe('loadService', () => {
        it('should load specific service from proto file', async () => {
            const mockService = jest.fn();
            (mockPackageDefinition.test.TestService as jest.Mock) = mockService;

            const result = await protoLoaderService.loadService('TestService');

            expect(result).toBe(mockService);
        });

        it('should throw error if service not found', async () => {
            await expect(protoLoaderService.loadService('NonExistentService')).rejects.toThrow();
        });
    });

    describe('getProtoDefinition', () => {
        it('should return the loaded proto definition', async () => {
            // First load the proto
            await protoLoaderService.load();

            // Then get the definition
            const result = protoLoaderService.getProtoDefinition();

            expect(result).toEqual(mockPackageDefinition);
        });

        it('should return undefined if proto not loaded yet', () => {
            const result = protoLoaderService.getProtoDefinition();
            expect(result).toBeUndefined();
        });
    });
});
