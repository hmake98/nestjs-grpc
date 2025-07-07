import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { GRPC_OPTIONS } from '../../src/constants';
import { ProtoLoaderService } from '../../src/services/proto-loader.service';
import { GrpcOptions } from '../../src/interfaces';
import * as protoUtils from '../../src/utils/proto-utils';

jest.mock('fs');
jest.mock('glob');
jest.mock('../../src/utils/proto-utils');

describe('ProtoLoaderService', () => {
    let service: ProtoLoaderService;
    let mockOptions: GrpcOptions;
    let mockFs: jest.Mocked<typeof fs>;
    let mockGlob: jest.MockedFunction<typeof glob>;
    let mockProtoUtils: jest.Mocked<typeof protoUtils>;

    beforeEach(async () => {
        mockFs = fs as jest.Mocked<typeof fs>;
        mockGlob = glob as jest.MockedFunction<typeof glob>;
        mockProtoUtils = protoUtils as jest.Mocked<typeof protoUtils>;

        mockOptions = {
            protoPath: '/test/path.proto',
            package: 'test.package',
            url: 'localhost:5000',
            logging: {
                level: 'log',
                debug: false,
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProtoLoaderService,
                {
                    provide: GRPC_OPTIONS,
                    useValue: mockOptions,
                },
            ],
        }).compile();

        service = module.get<ProtoLoaderService>(ProtoLoaderService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should validate options on construction', () => {
            expect(() => {
                new ProtoLoaderService(null as any);
            }).toThrow('GRPC_OPTIONS is required');
        });

        it('should throw error for missing protoPath', () => {
            expect(() => {
                new ProtoLoaderService({ package: 'test' } as any);
            }).toThrow('protoPath is required and must be a string');
        });

        it('should throw error for invalid protoPath type', () => {
            expect(() => {
                new ProtoLoaderService({ protoPath: 123, package: 'test' } as any);
            }).toThrow('protoPath is required and must be a string');
        });

        it('should throw error for missing package', () => {
            expect(() => {
                new ProtoLoaderService({ protoPath: '/test.proto' } as any);
            }).toThrow('package is required and must be a string');
        });

        it('should throw error for invalid package type', () => {
            expect(() => {
                new ProtoLoaderService({ protoPath: '/test.proto', package: 123 } as any);
            }).toThrow('package is required and must be a string');
        });

        it('should accept valid options', () => {
            expect(() => {
                new ProtoLoaderService({
                    protoPath: '/test.proto',
                    package: 'test.package',
                    url: 'localhost:5000',
                });
            }).not.toThrow();
        });

        it('should enable debug logging when configured', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            new ProtoLoaderService({
                protoPath: '/test.proto',
                package: 'test.package',
                url: 'localhost:5000',
                logging: { debug: true },
            });
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('onModuleInit', () => {
        it('should load proto files on module init', async () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            await service.onModuleInit();

            expect(mockProtoUtils.loadProto).toHaveBeenCalled();
        });

        it('should handle errors during module init', async () => {
            mockFs.accessSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            await expect(service.onModuleInit()).rejects.toThrow('Failed to load proto file(s)');
        });
    });

    describe('load', () => {
        it('should return cached definition if already loaded', async () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            const result1 = await service.load();
            const result2 = await service.load();

            expect(result1).toBe(result2);
            expect(mockProtoUtils.loadProto).toHaveBeenCalledTimes(1);
        });

        it('should return existing loading promise if already in progress', async () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            const promise1 = service.load();
            const promise2 = service.load();

            expect(promise1).toBe(promise2);
            await promise1;
            await promise2;
        });

        it('should handle single proto file loading', async () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            const result = await service.load();

            expect(result).toBe(mockProtoDefinition);
            expect(mockProtoUtils.loadProto).toHaveBeenCalledWith(
                mockOptions.protoPath,
                mockOptions.loaderOptions
            );
        });

        it('should handle directory with multiple proto files', async () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition);

            const result = await service.load();

            expect(result).toEqual(mockProtoDefinition);
            expect(mockGlob).toHaveBeenCalled();
        });

        it('should handle glob pattern loading', async () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            service = new ProtoLoaderService({
                ...mockOptions,
                protoPath: '/test/*.proto',
            });
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition);

            const result = await service.load();

            expect(result).toEqual(mockProtoDefinition);
            expect(mockGlob).toHaveBeenCalledWith('/test/*.proto', expect.any(Object));
        });

        it('should reset loading promise on error', async () => {
            mockFs.accessSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            await expect(service.load()).rejects.toThrow();
            await expect(service.load()).rejects.toThrow();

            expect(mockFs.accessSync).toHaveBeenCalledTimes(2);
        });

        it('should handle errors during proto loading', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockRejectedValue(new Error('Proto load failed'));

            await expect(service.load()).rejects.toThrow('Failed to load proto file(s)');
        });
    });

    describe('getProtoDefinition', () => {
        it('should return proto definition when loaded', async () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            await service.load();
            const result = service.getProtoDefinition();

            expect(result).toBe(mockProtoDefinition);
        });

        it('should throw error when not loaded', () => {
            expect(() => service.getProtoDefinition()).toThrow(
                'Proto files have not been loaded yet'
            );
        });
    });

    describe('loadService', () => {
        it('should validate service name', async () => {
            await expect(service.loadService('')).rejects.toThrow('Service name is required');
            await expect(service.loadService(null as any)).rejects.toThrow('Service name is required');
            await expect(service.loadService('   ')).rejects.toThrow('Service name cannot be empty');
        });

        it('should load service from single file', async () => {
            const mockService = jest.fn();
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue({});
            mockProtoUtils.getServiceByName.mockReturnValue(mockService);

            const result = await service.loadService('TestService');

            expect(result).toBe(mockService);
            expect(mockProtoUtils.getServiceByName).toHaveBeenCalledWith(
                {},
                mockOptions.package,
                'TestService'
            );
        });

        it('should load service from multiple files', async () => {
            const mockService = jest.fn();
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto']);
            mockProtoUtils.loadProto.mockResolvedValue({});
            mockProtoUtils.getServiceByName.mockReturnValue(mockService);

            const result = await service.loadService('TestService');

            expect(result).toBe(mockService);
        });

        it('should handle service not found in any file', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto']);
            mockProtoUtils.loadProto.mockResolvedValue({});
            mockProtoUtils.getServiceByName.mockReturnValue(null);

            await expect(service.loadService('TestService')).rejects.toThrow(
                'Service TestService not found in any proto file'
            );
        });

        it('should handle service not found in single file', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue({});
            mockProtoUtils.getServiceByName.mockReturnValue(null);

            await expect(service.loadService('TestService')).rejects.toThrow(
                'Service TestService not found in package'
            );
        });

        it('should handle errors during service loading', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockRejectedValue(new Error('Load failed'));

            await expect(service.loadService('TestService')).rejects.toThrow(
                'Failed to load service TestService'
            );
        });
    });

    describe('private methods', () => {
        it('should validate proto path accessibility', async () => {
            mockFs.accessSync.mockImplementation(() => {
                throw new Error('Access denied');
            });

            await expect(service.load()).rejects.toThrow('Proto path is not accessible');
        });

        it('should handle no proto files found', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue([]);

            await expect(service.load()).rejects.toThrow('No proto files found');
        });

        it('should handle errors in individual proto files', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockProtoUtils.loadProto
                .mockRejectedValueOnce(new Error('Load failed'))
                .mockResolvedValueOnce({ TestService: jest.fn() } as any);

            const result = await service.load();

            expect(result).toEqual({ TestService: expect.any(Function) });
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error loading proto file'));
            consoleSpy.mockRestore();
        });

        it('should handle no services loaded successfully', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto']);
            mockProtoUtils.loadProto.mockRejectedValue(new Error('Load failed'));

            await expect(service.load()).rejects.toThrow('No services loaded successfully');
        });

        it('should handle file access errors during validation', async () => {
            mockFs.accessSync.mockImplementation(() => {
                throw new Error('Access denied');
            });
            mockGlob.mockResolvedValue(['/test/file1.proto']);

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockProtoUtils.loadProto.mockResolvedValue({ TestService: jest.fn() } as any);

            await service.load();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot read proto file'));
            consoleSpy.mockRestore();
        });

        it('should handle glob errors', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockRejectedValue(new Error('Glob failed'));

            await expect(service.load()).rejects.toThrow('Error finding proto files');
        });

        it('should handle package navigation errors', async () => {
            const mockProtoDefinition = null;
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            await expect(service.load()).rejects.toThrow('Failed to find package');
        });

        it('should handle invalid package structure', async () => {
            const mockProtoDefinition = { 'test.package': 'invalid' };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            await expect(service.load()).rejects.toThrow('Invalid package structure');
        });

        it('should handle missing package part', async () => {
            const mockProtoDefinition = { test: {} };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition);

            await expect(service.load()).rejects.toThrow('Package part \'package\' not found');
        });

        it('should handle debug logging for loaded services', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            service = new ProtoLoaderService({
                ...mockOptions,
                logging: { debug: true },
            });
            const mockProtoDefinition = { TestService: jest.fn() };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            await service.load();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded services'));
            consoleSpy.mockRestore();
        });
    });
});
