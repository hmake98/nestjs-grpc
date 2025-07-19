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

describe.skip('ProtoLoaderService', () => {
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
                logging: { level: 'debug' },
            });
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('onModuleInit', () => {
        it('should load proto files on module init', async () => {
            const mockProtoDefinition = { TestService: jest.fn() } as any;
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
            const mockProtoDefinition = { TestService: jest.fn() } as any;
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            const result1 = await service.load();
            const result2 = await service.load();

            expect(result1).toBe(result2);
            expect(mockProtoUtils.loadProto).toHaveBeenCalledTimes(1);
        });

        it('should return existing loading promise if already in progress', async () => {
            const mockProtoDefinition = { TestService: jest.fn() } as any;
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
            const mockProtoDefinition = { TestService: jest.fn() } as any;
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            const result = await service.load();

            expect(result).toBe(mockProtoDefinition);
            expect(mockProtoUtils.loadProto).toHaveBeenCalledWith(
                mockOptions.protoPath,
                mockOptions.loaderOptions,
            );
        });

        it('should handle directory with multiple proto files', async () => {
            const mockProtoDefinition = { TestService: jest.fn() } as any;
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition);

            const result = await service.load();

            expect(result).toEqual(mockProtoDefinition);
            expect(mockGlob).toHaveBeenCalled();
        });

        it('should handle glob pattern loading', async () => {
            const mockProtoDefinition = { TestService: jest.fn() } as any;
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
            const mockProtoDefinition = { TestService: jest.fn() } as any;
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            await service.load();
            const result = service.getProtoDefinition();

            expect(result).toBe(mockProtoDefinition);
        });

        it('should throw error when not loaded', () => {
            expect(() => service.getProtoDefinition()).toThrow(
                'Proto files have not been loaded yet',
            );
        });
    });

    describe('loadService', () => {
        it('should validate service name', async () => {
            await expect(service.loadService('')).rejects.toThrow('Service name is required');
            await expect(service.loadService(null as any)).rejects.toThrow(
                'Service name is required',
            );
            await expect(service.loadService('   ')).rejects.toThrow(
                'Service name cannot be empty',
            );
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
                'TestService',
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
                'Service TestService not found in any proto file',
            );
        });

        it('should handle service not found in single file', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue({});
            mockProtoUtils.getServiceByName.mockReturnValue(null);

            await expect(service.loadService('TestService')).rejects.toThrow(
                'Service TestService not found in package',
            );
        });

        it('should handle errors during service loading', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockRejectedValue(new Error('Load failed'));

            await expect(service.loadService('TestService')).rejects.toThrow(
                'Failed to load service TestService',
            );
        });
    });

    describe('private helper methods', () => {
        it('should correctly identify glob patterns', () => {
            const testService = new ProtoLoaderService(mockOptions);
            expect((testService as any).isGlobPattern('**/*.proto')).toBe(true);
            expect((testService as any).isGlobPattern('/test/*.proto')).toBe(true);
            expect((testService as any).isGlobPattern('/test/file?.proto')).toBe(true);
            expect((testService as any).isGlobPattern('/test/file[1-3].proto')).toBe(true);
            expect((testService as any).isGlobPattern('/test/{a,b}.proto')).toBe(true);
            expect((testService as any).isGlobPattern('/test/!exclude.proto')).toBe(true);
            expect((testService as any).isGlobPattern('/test/file.proto')).toBe(false);
        });

        it('should correctly identify directories', () => {
            const testService = new ProtoLoaderService(mockOptions);
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            expect((testService as any).isDirectory('/test/dir')).toBe(true);

            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            expect((testService as any).isDirectory('/test/file.proto')).toBe(false);

            mockFs.statSync.mockImplementation(() => {
                throw new Error('Not found');
            });
            expect((testService as any).isDirectory('/test/nonexistent')).toBe(false);
        });

        it('should extract service names from loaded definition', () => {
            const testService = new ProtoLoaderService(mockOptions);
            const definition = {
                TestService: jest.fn(),
                AnotherService: jest.fn(),
                notAService: { someProperty: 'value' },
            };

            const serviceNames = (testService as any).getLoadedServiceNames(definition);
            expect(serviceNames).toEqual(['TestService', 'AnotherService']);
        });

        it('should handle empty definition when extracting service names', () => {
            const testService = new ProtoLoaderService(mockOptions);
            expect((testService as any).getLoadedServiceNames(null)).toEqual([]);
            expect((testService as any).getLoadedServiceNames(undefined)).toEqual([]);
            expect((testService as any).getLoadedServiceNames({})).toEqual([]);
            expect((testService as any).getLoadedServiceNames('invalid')).toEqual([]);
        });

        it('should handle errors gracefully when extracting service names', () => {
            const testService = new ProtoLoaderService(mockOptions);
            const problematicDefinition = {
                get TestService() {
                    throw new Error('Access error');
                },
            };

            expect((testService as any).getLoadedServiceNames(problematicDefinition)).toEqual([]);
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
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error loading proto file'),
            );
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

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Cannot read proto file'),
            );
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

            await expect(service.load()).rejects.toThrow("Package part 'package' not found");
        });

        it('should handle debug logging for loaded services', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            service = new ProtoLoaderService({
                ...mockOptions,
                logging: { level: 'debug' },
            });
            const mockProtoDefinition = { TestService: jest.fn() } as any;
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            await service.load();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded services'));
            consoleSpy.mockRestore();
        });

        it('should handle getServiceByPackageName with null package name', () => {
            const testService = new ProtoLoaderService(mockOptions);
            const proto = { TestService: jest.fn() };

            const result = (testService as any).getServiceByPackageName(proto, '');
            expect(result).toBe(proto);
        });

        it('should handle getServiceByPackageName with nested package structure', () => {
            const testService = new ProtoLoaderService(mockOptions);
            const proto = {
                com: {
                    example: {
                        TestService: jest.fn(),
                    },
                },
            };

            const result = (testService as any).getServiceByPackageName(proto, 'com.example');
            expect(result).toBe(proto.com.example);
        });

        it('should handle getServiceByPackageName with invalid proto definition', () => {
            const testService = new ProtoLoaderService(mockOptions);

            expect(() => {
                (testService as any).getServiceByPackageName(null, 'test.package');
            }).toThrow('Proto definition is null or undefined');
        });

        it('should handle findProtoFiles with directory conversion', async () => {
            const testService = new ProtoLoaderService(mockOptions);
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockFs.accessSync.mockImplementation(() => {});

            const files = await (testService as any).findProtoFiles('/test/dir');

            expect(mockGlob).toHaveBeenCalledWith(
                expect.stringContaining('**/*.proto'),
                expect.objectContaining({
                    ignore: ['node_modules/**', '**/node_modules/**'],
                    absolute: true,
                    nodir: true,
                }),
            );
            expect(files).toEqual(['/test/file1.proto', '/test/file2.proto']);
        });

        it('should filter out unreadable files during findProtoFiles', async () => {
            const testService = new ProtoLoaderService(mockOptions);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockFs.accessSync
                .mockImplementationOnce(() => {}) // file1.proto - readable
                .mockImplementationOnce(() => {
                    throw new Error('Access denied');
                }); // file2.proto - not readable

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const files = await (testService as any).findProtoFiles('/test/*.proto');

            expect(files).toEqual(['/test/file1.proto']);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Cannot read proto file'),
            );
            consoleSpy.mockRestore();
        });

        it('should handle multiple proto files with partial failures', async () => {
            const testService = new ProtoLoaderService(mockOptions);
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue([
                '/test/file1.proto',
                '/test/file2.proto',
                '/test/file3.proto',
            ]);

            mockProtoUtils.loadProto
                .mockRejectedValueOnce(new Error('Parse error in file1'))
                .mockResolvedValueOnce({ TestService1: jest.fn() } as any)
                .mockResolvedValueOnce({ TestService2: jest.fn() } as any);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await (testService as any).loadMultipleProtoFiles('/test/', 'test', {});

            expect(result).toEqual({
                TestService1: expect.any(Function),
                TestService2: expect.any(Function),
            });
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error loading proto file'),
            );
            consoleSpy.mockRestore();
        });

        it('should suppress error logging when logErrors is false', async () => {
            const optionsWithoutErrorLogging = {
                ...mockOptions,
                logging: { logErrors: false },
            };
            const testService = new ProtoLoaderService(optionsWithoutErrorLogging);
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);

            mockProtoUtils.loadProto
                .mockRejectedValueOnce(new Error('Parse error'))
                .mockResolvedValueOnce({ TestService: jest.fn() } as any);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await (testService as any).loadMultipleProtoFiles('/test/', 'test', {});

            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should handle debug logging during multiple file loading', async () => {
            const debugOptions = {
                ...mockOptions,
                logging: { level: 'debug' as const, debug: true },
            };
            const testService = new ProtoLoaderService(debugOptions);
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto']);
            mockProtoUtils.loadProto.mockResolvedValue({ TestService: jest.fn() } as any);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await (testService as any).loadMultipleProtoFiles('/test/', 'test', {});

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Loading proto file'));
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Loaded services from'),
            );
            consoleSpy.mockRestore();
        });

        it('should handle service loading from multiple files with all failures', async () => {
            const testService = new ProtoLoaderService(mockOptions);
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);

            mockProtoUtils.loadProto.mockRejectedValue(new Error('Load failed'));

            await expect(
                (testService as any).loadServiceFromMultipleFiles(
                    'TestService',
                    '/test/',
                    'test',
                    {},
                ),
            ).rejects.toThrow('Service TestService not found in any proto file');
        });

        it('should handle early return when service found in multiple files', async () => {
            const testService = new ProtoLoaderService(mockOptions);
            const mockService = jest.fn();
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);

            mockProtoUtils.loadProto.mockResolvedValue({});
            mockProtoUtils.getServiceByName
                .mockReturnValueOnce(mockService) // Found in first file
                .mockReturnValueOnce(jest.fn()); // Second file shouldn't be checked

            const result = await (testService as any).loadServiceFromMultipleFiles(
                'TestService',
                '/test/',
                'test',
                {},
            );

            expect(result).toBe(mockService);
            expect(mockProtoUtils.loadProto).toHaveBeenCalledTimes(1); // Should stop after finding service
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle empty package name in getServiceByPackageName', () => {
            const testService = new ProtoLoaderService(mockOptions);
            const proto = { TestService: jest.fn() };

            const result = (testService as any).getServiceByPackageName(proto, null);
            expect(result).toBe(proto);

            const result2 = (testService as any).getServiceByPackageName(proto, undefined);
            expect(result2).toBe(proto);
        });

        it('should handle loadService with empty protoFiles array for multiple files', async () => {
            const testService = new ProtoLoaderService(mockOptions);
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue([]);

            await expect(testService.loadService('TestService')).rejects.toThrow(
                'No proto files found in',
            );
        });

        it('should validate service name parameter with whitespace', async () => {
            await expect(service.loadService('  \t\n  ')).rejects.toThrow(
                'Service name cannot be empty',
            );
        });

        it('should handle concurrent load operations correctly', async () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            let resolveProtoLoad: (value: any) => void;
            const protoLoadPromise = new Promise(resolve => {
                resolveProtoLoad = resolve;
            });
            mockProtoUtils.loadProto.mockReturnValue(protoLoadPromise as any);

            // Start multiple concurrent loads
            const load1 = service.load();
            const load2 = service.load();
            const load3 = service.load();

            // All should be the same promise
            expect(load1).toBe(load2);
            expect(load2).toBe(load3);

            // Resolve the proto loading
            resolveProtoLoad!(mockProtoDefinition);

            const [result1, result2, result3] = await Promise.all([load1, load2, load3]);

            expect(result1).toBe(mockProtoDefinition);
            expect(result2).toBe(mockProtoDefinition);
            expect(result3).toBe(mockProtoDefinition);

            // Subsequent calls should return cached result
            const load4 = await service.load();
            expect(load4).toBe(mockProtoDefinition);
            expect(mockProtoUtils.loadProto).toHaveBeenCalledTimes(1);
        });

        it('should handle proto definition with no services in single file', async () => {
            const mockProtoDefinition = {}; // Empty object - no services
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition);

            await expect(service.load()).rejects.toThrow('No services found in package');
        });

        it('should handle all proto files failing to load', async () => {
            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockProtoUtils.loadProto.mockRejectedValue(new Error('Parse error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await expect(service.load()).rejects.toThrow('No services loaded successfully');
            expect(consoleSpy).toHaveBeenCalledTimes(2); // Once for each failed file
            consoleSpy.mockRestore();
        });
    });

    describe('integration scenarios', () => {
        it('should handle complex multi-level package structure', async () => {
            const testService = new ProtoLoaderService({
                protoPath: '/test.proto',
                package: 'com.example.services.auth',
                logging: { level: 'debug' as const },
            });

            const mockProtoDefinition = {
                com: {
                    example: {
                        services: {
                            auth: {
                                AuthService: jest.fn(),
                                UserService: jest.fn(),
                            },
                        },
                    },
                },
            };

            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockProtoDefinition as any);

            const result = await testService.load();

            expect(result).toBe(mockProtoDefinition.com.example.services.auth);
            expect(result.AuthService).toBeDefined();
            expect(result.UserService).toBeDefined();
        });

        it('should handle real-world scenario with mixed file types and errors', async () => {
            const testService = new ProtoLoaderService({
                ...mockOptions,
                protoPath: '/project/protos',
                logging: { level: 'debug' as const, logErrors: true },
            });

            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue([
                '/project/protos/auth.proto',
                '/project/protos/user.proto',
                '/project/protos/invalid.proto',
                '/project/protos/empty.proto',
            ]);

            // Mock file access - one file is unreadable
            mockFs.accessSync
                .mockImplementationOnce(() => {}) // auth.proto - ok
                .mockImplementationOnce(() => {}) // user.proto - ok
                .mockImplementationOnce(() => {
                    throw new Error('Permission denied');
                }) // invalid.proto - unreadable
                .mockImplementationOnce(() => {}); // empty.proto - ok

            // Mock proto loading - mixed success/failure
            mockProtoUtils.loadProto
                .mockResolvedValueOnce({ AuthService: jest.fn() } as any) // auth.proto - success
                .mockResolvedValueOnce({ UserService: jest.fn() } as any) // user.proto - success
                .mockRejectedValueOnce(new Error('Parse error')); // empty.proto - failure

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await testService.load();

            expect(result).toEqual({
                AuthService: expect.any(Function),
                UserService: expect.any(Function),
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Cannot read proto file'),
            );
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error loading proto file'),
            );

            consoleSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should handle service loading with complex package structures', async () => {
            const testService = new ProtoLoaderService({
                protoPath: '/test.proto',
                package: 'grpc.service',
                logging: { level: 'log' as const },
            });

            const mockPackageDefinition = {
                grpc: {
                    service: {
                        TestService: jest.fn(),
                    },
                },
            };

            mockFs.accessSync.mockImplementation(() => {});
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockProtoUtils.loadProto.mockResolvedValue(mockPackageDefinition as any);
            mockProtoUtils.getServiceByName.mockReturnValue(
                mockPackageDefinition.grpc.service.TestService,
            );

            const result = await testService.loadService('TestService');

            expect(result).toBe(mockPackageDefinition.grpc.service.TestService);
            expect(mockProtoUtils.getServiceByName).toHaveBeenCalledWith(
                mockPackageDefinition,
                'grpc.service',
                'TestService',
            );
        });
    });
});
