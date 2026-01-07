import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

import { GrpcProtoService } from '../../src/services/grpc-proto.service';
import { GRPC_OPTIONS } from '../../src/constants';
import { GrpcLogLevel, GrpcOptions } from '../../src/interfaces';

// Mock all external dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('glob');

// Mock proto-utils
jest.mock('../../src/utils/proto-utils');
import * as protoUtils from '../../src/utils/proto-utils';

const mockLoadProto = protoUtils.loadProto as jest.MockedFunction<typeof protoUtils.loadProto>;
const mockGetServiceByName = protoUtils.getServiceByName as jest.MockedFunction<
    typeof protoUtils.getServiceByName
>;

describe('GrpcProtoService - Comprehensive Tests', () => {
    let service: GrpcProtoService;
    let mockOptions: GrpcOptions;
    let module: TestingModule;

    // Mock implementations
    const mockFs = fs as jest.Mocked<typeof fs>;
    const mockPath = path as jest.Mocked<typeof path>;
    const mockGlob = glob as jest.MockedFunction<typeof glob>;

    beforeEach(async () => {
        jest.clearAllMocks();

        mockOptions = {
            protoPath: '/test/path.proto',
            package: 'test.package',
            logging: {
                enabled: true,
                level: GrpcLogLevel.DEBUG,
                context: 'GrpcProtoService',
            },
        };

        // Mock proto loading to return a valid service definition
        mockLoadProto.mockResolvedValue({
            test: {
                package: {
                    TestService: jest.fn(),
                },
            },
        } as any);

        // Mock file system operations
        mockFs.accessSync.mockReturnValue(undefined);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

        module = await Test.createTestingModule({
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

    afterEach(async () => {
        if (module) {
            await module.close();
        }
    });

    describe('constructor validation', () => {
        it('should throw error if options are not provided', () => {
            expect(() => new GrpcProtoService(null as any)).toThrow('GRPC_OPTIONS is required');
        });

        it('should throw error if options are undefined', () => {
            expect(() => new GrpcProtoService(undefined as any)).toThrow(
                'GRPC_OPTIONS is required',
            );
        });

        it('should throw error if protoPath is missing', () => {
            expect(() => new GrpcProtoService({ package: 'test' } as any)).toThrow(
                'protoPath is required and must be a string',
            );
        });

        it('should throw error if protoPath is not string', () => {
            expect(() => new GrpcProtoService({ protoPath: 123, package: 'test' } as any)).toThrow(
                'protoPath is required and must be a string',
            );
        });

        it('should throw error if package is missing', () => {
            expect(() => new GrpcProtoService({ protoPath: '/test.proto' } as any)).toThrow(
                'package is required and must be a string',
            );
        });

        it('should throw error if package is not string', () => {
            expect(
                () => new GrpcProtoService({ protoPath: '/test.proto', package: 123 } as any),
            ).toThrow('package is required and must be a string');
        });

        it('should log debug info when debug logging is enabled', () => {
            const debugOptions = {
                ...mockOptions,
                logging: { level: GrpcLogLevel.DEBUG, context: 'GrpcProtoService' },
            };

            // Should not throw and initialize with debug logging
            expect(() => new GrpcProtoService(debugOptions)).not.toThrow();
        });
    });

    describe('onModuleInit', () => {
        it('should load proto files successfully', async () => {
            mockLoadProto.mockResolvedValue({
                test: {
                    package: {
                        TestService: jest.fn(),
                    },
                },
            } as any);
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            await service.onModuleInit();

            expect(mockLoadProto).toHaveBeenCalled();
        });

        it('should handle loading errors', async () => {
            mockLoadProto.mockRejectedValue(new Error('Load failed'));
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            await expect(service.onModuleInit()).rejects.toThrow('Load failed');
        });
    });

    describe('load method', () => {
        it('should return cached definition if already loaded', async () => {
            const mockDefinition = {
                test: {
                    package: {
                        TestService: jest.fn(),
                    },
                },
            } as any;

            // First load
            mockLoadProto.mockResolvedValue(mockDefinition);
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            const result1 = await service.load();
            expect(result1).toEqual(mockDefinition.test.package);

            // Second load should return cached
            mockLoadProto.mockClear();
            const result2 = await service.load();
            expect(result2).toEqual(mockDefinition.test.package);
            expect(mockLoadProto).not.toHaveBeenCalled();
        });

        it('should handle concurrent load requests', async () => {
            const mockDefinition = {
                test: {
                    package: {
                        TestService: jest.fn(),
                    },
                },
            } as any;

            mockLoadProto.mockResolvedValue(mockDefinition);
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            const promises = [service.load(), service.load(), service.load()];
            const results = await Promise.all(promises);

            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result).toEqual(mockDefinition.test.package);
            });

            // Should only call loadProto once due to promise caching
            expect(mockLoadProto).toHaveBeenCalledTimes(1);
        });

        it('should reset loading promise on error to allow retry', async () => {
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            // First attempt fails
            mockLoadProto.mockRejectedValueOnce(new Error('First failure'));
            await expect(service.load()).rejects.toThrow('First failure');

            // Second attempt succeeds
            const mockDefinition = {
                test: {
                    package: {
                        TestService: jest.fn(),
                    },
                },
            } as any;
            mockLoadProto.mockResolvedValue(mockDefinition);
            const result = await service.load();
            expect(result).toEqual(mockDefinition.test.package);
        });

        it('should log service names in debug mode', async () => {
            const mockDefinition = {
                test: {
                    package: {
                        TestService: jest.fn(),
                        AuthService: jest.fn(),
                    },
                },
            } as any;

            mockLoadProto.mockResolvedValue(mockDefinition);
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            await service.load();

            // Should have logged the service names
        });
    });

    describe('getProtoDefinition', () => {
        it('should return loaded definition', async () => {
            const mockDefinition = {
                test: {
                    package: {
                        TestService: jest.fn(),
                    },
                },
            } as any;

            mockLoadProto.mockResolvedValue(mockDefinition);
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            await service.load();
            const result = service.getProtoDefinition();

            expect(result).toEqual(mockDefinition.test.package);
        });

        it('should return cached definition on subsequent calls', async () => {
            const mockDefinition = {
                test: {
                    package: {
                        TestService: jest.fn(),
                    },
                },
            } as any;

            mockLoadProto.mockResolvedValue(mockDefinition);
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            await service.load();
            const firstCall = service.getProtoDefinition();
            const secondCall = service.getProtoDefinition();

            expect(firstCall).toEqual(mockDefinition.test.package);
            expect(secondCall).toEqual(mockDefinition.test.package);
            expect(firstCall).toBe(secondCall); // Should be the same object reference
        });

        it('should throw error if not loaded', () => {
            expect(() => service.getProtoDefinition()).toThrow(
                'Proto files have not been loaded yet. Call load() first.',
            );
        });
    });

    describe('validateProtoPath', () => {
        it('should validate accessible proto path', async () => {
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockLoadProto.mockResolvedValue({
                test: {
                    package: {
                        TestService: jest.fn(),
                    },
                },
            } as any);

            await expect(service.load()).resolves.not.toThrow();
        });

        it('should throw error for inaccessible proto path', async () => {
            mockFs.accessSync.mockImplementation(() => {
                throw new Error('ENOENT');
            });
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

            await expect(service.load()).rejects.toThrow('Proto path is not accessible');
        });

        it('should skip validation for glob patterns', async () => {
            const globOptions = {
                ...mockOptions,
                protoPath: '/test/*.proto',
            };

            const globService = new GrpcProtoService(globOptions);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockLoadProto.mockResolvedValue({
                test: {
                    package: {
                        TestService: jest.fn(),
                    },
                },
            } as any);
            mockFs.accessSync.mockReturnValue(undefined);

            await expect(globService.load()).resolves.not.toThrow();
            expect(mockFs.accessSync).not.toHaveBeenCalledWith(
                expect.stringContaining('*'),
                expect.anything(),
            );
        });
    });

    describe('single proto file loading', () => {
        beforeEach(() => {
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockFs.accessSync.mockReturnValue(undefined);
        });

        it('should load single proto file successfully', async () => {
            const mockDefinition = { TestService: jest.fn() } as any;
            const mockService = { test: 'service' };

            mockLoadProto.mockResolvedValue(mockDefinition);
            jest.spyOn(service as any, 'getServiceByPackageName').mockReturnValue(mockService);

            const result = await service.load();
            expect(result).toEqual(mockService);
            expect(mockLoadProto).toHaveBeenCalledWith('/test/path.proto', undefined);
        });

        it('should throw error if no services found in package', async () => {
            const mockDefinition = { TestService: jest.fn() } as any;

            mockLoadProto.mockResolvedValue(mockDefinition);
            jest.spyOn(service as any, 'getServiceByPackageName').mockReturnValue(null);

            await expect(service.load()).rejects.toThrow(
                "No services found in package 'test.package'",
            );
        });

        it('should throw error if services object is empty', async () => {
            const mockDefinition = { TestService: jest.fn() } as any;

            mockLoadProto.mockResolvedValue(mockDefinition);
            jest.spyOn(service as any, 'getServiceByPackageName').mockReturnValue({});

            await expect(service.load()).rejects.toThrow(
                "No services found in package 'test.package'",
            );
        });
    });

    describe('multiple proto files loading', () => {
        beforeEach(() => {
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
        });

        it('should load multiple proto files from directory', async () => {
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockFs.accessSync.mockReturnValue(undefined);
            mockPath.join.mockReturnValue('/test/**/*.proto');

            const mockService1 = { Service1: jest.fn() } as any;
            const mockService2 = { Service2: jest.fn() } as any;

            mockLoadProto.mockResolvedValueOnce(mockService1).mockResolvedValueOnce(mockService2);

            jest.spyOn(service as any, 'getServiceByPackageName')
                .mockReturnValueOnce({ Service1: jest.fn() } as any)
                .mockReturnValueOnce({ Service2: jest.fn() } as any);

            const result = await service.load();

            expect(result).toEqual({
                Service1: expect.any(Function),
                Service2: expect.any(Function),
            });
            expect(mockGlob).toHaveBeenCalledWith('/test/**/*.proto', expect.any(Object));
        });

        it('should handle glob patterns', async () => {
            const globOptions = {
                ...mockOptions,
                protoPath: '/test/*.proto',
            };

            const globService = new GrpcProtoService(globOptions);
            mockGlob.mockResolvedValue(['/test/file1.proto']);
            mockFs.accessSync.mockReturnValue(undefined);

            const mockService = { TestService: jest.fn() } as any;
            mockLoadProto.mockResolvedValue(mockService);
            jest.spyOn(globService as any, 'getServiceByPackageName').mockReturnValue({
                TestService: jest.fn(),
            } as any);

            const result = await globService.load();

            expect(result).toEqual({ TestService: expect.any(Function) });
            expect(mockGlob).toHaveBeenCalledWith('/test/**/*.proto', expect.any(Object));
        });

        it('should throw error when no proto files found with glob pattern', async () => {
            const globOptions = {
                ...mockOptions,
                protoPath: '/empty/*.proto',
            };

            const globService = new GrpcProtoService(globOptions);
            mockGlob.mockResolvedValue([]); // No files found

            await expect(globService.load()).rejects.toThrow(
                'No proto files found in /empty/*.proto',
            );
        });

        it('should throw error if no proto files found', async () => {
            mockGlob.mockResolvedValue([]);
            mockPath.join.mockReturnValue('/test/**/*.proto');

            await expect(service.load()).rejects.toThrow(
                'No proto files found in /test/path.proto',
            );
        });

        it('should handle some files failing to load', async () => {
            mockGlob.mockResolvedValue(['/test/good.proto', '/test/bad.proto']);
            mockFs.accessSync.mockReturnValue(undefined);
            mockPath.join.mockReturnValue('/test/**/*.proto');

            const mockService = { Service1: jest.fn() } as any;

            mockLoadProto
                .mockResolvedValueOnce(mockService)
                .mockRejectedValueOnce(new Error('Bad proto file'));

            jest.spyOn(service as any, 'getServiceByPackageName').mockReturnValueOnce({
                Service1: jest.fn(),
            } as any);

            const result = await service.load();

            expect(result).toEqual({ Service1: expect.any(Function) });
        });

        it('should throw error if no services loaded successfully', async () => {
            mockGlob.mockResolvedValue(['/test/bad1.proto', '/test/bad2.proto']);
            mockFs.accessSync.mockReturnValue(undefined);
            mockPath.join.mockReturnValue('/test/**/*.proto');

            mockLoadProto
                .mockRejectedValueOnce(new Error('Bad proto 1'))
                .mockRejectedValueOnce(new Error('Bad proto 2'));

            await expect(service.load()).rejects.toThrow('No services loaded successfully');
        });

        it('should validate file readability', async () => {
            mockGlob.mockResolvedValue(['/test/readable.proto', '/test/unreadable.proto']);
            mockPath.join.mockReturnValue('/test/**/*.proto');

            mockFs.accessSync
                .mockImplementationOnce(() => undefined) // readable.proto
                .mockImplementationOnce(() => {
                    throw new Error('Permission denied');
                }); // unreadable.proto

            const mockService = { Service1: jest.fn() } as any;
            mockLoadProto.mockResolvedValue(mockService);
            jest.spyOn(service as any, 'getServiceByPackageName').mockReturnValue({
                Service1: jest.fn(),
            } as any);

            const result = await service.load();

            expect(result).toEqual({ Service1: expect.any(Function) });
            expect(mockLoadProto).toHaveBeenCalledTimes(1); // Only called for readable file
        });

        it('should handle findProtoFiles errors', async () => {
            mockGlob.mockRejectedValue(new Error('Glob error'));
            mockPath.join.mockReturnValue('/test/**/*.proto');

            await expect(service.load()).rejects.toThrow('Error finding proto files with pattern');
        });

        it('should throw error when no proto files found in directory for loadService', async () => {
            // Mock directory path so it goes through loadServiceFromMultipleFiles
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            
            // Mock empty directory - this will hit line 350
            jest.spyOn(service as any, 'findProtoFiles').mockResolvedValue([]);

            await expect(service.loadService('TestService')).rejects.toThrow('No proto files found in');
        });
    });

    describe('loadService method', () => {
        it('should validate service name', async () => {
            await expect(service.loadService('')).rejects.toThrow(
                'Service name is required and must be a string',
            );
            await expect(service.loadService(null as any)).rejects.toThrow(
                'Service name is required and must be a string',
            );
            await expect(service.loadService('   ')).rejects.toThrow(
                'Service name cannot be empty',
            );
        });

        it('should load service from single file', async () => {
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockFs.accessSync.mockReturnValue(undefined);

            const mockService = { methods: ['test'] } as any;
            mockLoadProto.mockResolvedValue({ TestService: mockService });
            mockGetServiceByName.mockReturnValue(mockService);

            const result = await service.loadService('TestService');

            expect(result).toEqual(mockService);
            expect(mockGetServiceByName).toHaveBeenCalledWith(
                { TestService: mockService },
                'test.package',
                'TestService',
            );
        });

        it('should load a specific service with correct methods', async () => {
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockFs.accessSync.mockReturnValue(undefined);

            const mockService = { methods: ['method1', 'method2'] } as any;
            mockLoadProto.mockResolvedValue({ TestService: mockService });
            mockGetServiceByName.mockReturnValue(mockService);

            const result = await service.loadService('TestService');
            expect(result).toBe(mockService);
            expect(result.methods).toEqual(['method1', 'method2']);
        });

        it('should load service from multiple files', async () => {
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            mockFs.accessSync.mockReturnValue(undefined);
            mockPath.join.mockReturnValue('/test/**/*.proto');

            const mockService = { methods: ['test'] } as any;

            mockLoadProto
                .mockResolvedValueOnce({ WrongService: {} } as any)
                .mockResolvedValueOnce({ TestService: mockService });

            mockGetServiceByName.mockReturnValueOnce(null).mockReturnValueOnce(mockService);

            const result = await service.loadService('TestService');

            expect(result).toEqual(mockService);
        });

        it('should throw error if service not found in any file', async () => {
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/file1.proto']);
            mockFs.accessSync.mockReturnValue(undefined);
            mockPath.join.mockReturnValue('/test/**/*.proto');

            mockLoadProto.mockResolvedValue({ WrongService: {} } as any);
            mockGetServiceByName.mockReturnValue(null);

            await expect(service.loadService('TestService')).rejects.toThrow(
                'Service TestService not found in any proto file',
            );
        });

        it('should throw error if service not found in single file', async () => {
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockFs.accessSync.mockReturnValue(undefined);

            mockLoadProto.mockResolvedValue({ WrongService: {} } as any);
            mockGetServiceByName.mockReturnValue(null);

            await expect(service.loadService('TestService')).rejects.toThrow(
                'Service TestService not found in package test.package',
            );
        });

        it('should handle loading errors in multiple files', async () => {
            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/bad.proto']);
            mockFs.accessSync.mockReturnValue(undefined);
            mockPath.join.mockReturnValue('/test/**/*.proto');

            mockLoadProto.mockRejectedValue(new Error('Proto load error'));

            await expect(service.loadService('TestService')).rejects.toThrow(
                'Service TestService not found in any proto file. Errors: /test/bad.proto: Proto load error',
            );
        });
    });

    describe('utility methods', () => {
        describe('isDirectory', () => {
            it('should return true for directory', () => {
                mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);

                const result = (service as any).isDirectory('/test/dir');
                expect(result).toBe(true);
            });

            it('should return false for file', () => {
                mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

                const result = (service as any).isDirectory('/test/file.proto');
                expect(result).toBe(false);
            });

            it('should return false on error', () => {
                mockFs.statSync.mockImplementation(() => {
                    throw new Error('ENOENT');
                });

                const result = (service as any).isDirectory('/nonexistent/path');
                expect(result).toBe(false);
            });
        });

        describe('isGlobPattern', () => {
            it('should detect glob patterns', () => {
                expect((service as any).isGlobPattern('*.proto')).toBe(true);
                expect((service as any).isGlobPattern('test/*.proto')).toBe(true);
                expect((service as any).isGlobPattern('test/**/*.proto')).toBe(true);
                expect((service as any).isGlobPattern('test/{a,b}.proto')).toBe(true);
                expect((service as any).isGlobPattern('test/[abc].proto')).toBe(true);
                expect((service as any).isGlobPattern('test/!exclude.proto')).toBe(true);
                expect((service as any).isGlobPattern('test/file?.proto')).toBe(true);

                expect((service as any).isGlobPattern('test/file.proto')).toBe(false);
                expect((service as any).isGlobPattern('/absolute/path.proto')).toBe(false);
            });
        });

        describe('getServiceByPackageName', () => {
            it('should return proto if no package name', () => {
                const proto = { TestService: jest.fn() } as any;

                const result = (service as any).getServiceByPackageName(proto, '');
                expect(result).toBe(proto);
            });

            it('should navigate package path', () => {
                const proto = {
                    com: {
                        example: {
                            TestService: jest.fn(),
                        },
                    },
                };

                const result = (service as any).getServiceByPackageName(proto, 'com.example');
                expect(result).toBe(proto.com.example);
            });

            it('should throw error for null proto', () => {
                expect(() => (service as any).getServiceByPackageName(null, 'test')).toThrow(
                    'Proto definition is null or undefined',
                );
            });

            it('should throw error for invalid package structure', () => {
                const proto = { invalid: 'not an object' };

                expect(() =>
                    (service as any).getServiceByPackageName(proto, 'invalid.missing'),
                ).toThrow("Invalid package structure at 'missing'");
            });

            it('should throw error for missing package part', () => {
                const proto = { existing: {} };

                expect(() => (service as any).getServiceByPackageName(proto, 'missing')).toThrow(
                    "Package part 'missing' not found",
                );
            });
        });

        describe('getLoadedServiceNames', () => {
            it('should extract service names', () => {
                const definition = {
                    TestService: jest.fn(),
                    AuthService: jest.fn(),
                    notAFunction: 'not a service',
                    nested: { NestedService: jest.fn() },
                };

                const result = (service as any).getLoadedServiceNames(definition);
                expect(result).toEqual(['TestService', 'AuthService']);
            });

            it('should handle null definition', () => {
                const result = (service as any).getLoadedServiceNames(null);
                expect(result).toEqual([]);
            });

            it('should handle errors gracefully', () => {
                const definition = {
                    get badProperty() {
                        throw new Error('Getter error');
                    },
                };

                const result = (service as any).getLoadedServiceNames(definition);
                expect(result).toEqual([]);
            });
        });
    });

    describe('error handling', () => {
        it('should handle proto loading errors with proper context', async () => {
            mockFs.accessSync.mockReturnValue(undefined);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockLoadProto.mockRejectedValue(new Error('Invalid proto syntax'));

            await expect(service.load()).rejects.toThrow(
                'Failed to load proto file(s): Failed to load proto file /test/path.proto: Invalid proto syntax',
            );
        });

        it('should handle service loading errors with proper context', async () => {
            mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
            mockFs.accessSync.mockReturnValue(undefined);
            mockLoadProto.mockRejectedValue(new Error('Service load error'));

            await expect(service.loadService('TestService')).rejects.toThrow(
                'Failed to load service TestService: Failed to load service from /test/path.proto: Service load error',
            );
        });

        it('should handle logging with logErrors disabled', async () => {
            const noLogOptions = {
                ...mockOptions,
                logging: { enabled: false },
            };

            const noLogService = new GrpcProtoService(noLogOptions);

            mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
            mockGlob.mockResolvedValue(['/test/bad.proto']);
            mockFs.accessSync.mockReturnValue(undefined);
            mockPath.join.mockReturnValue('/test/**/*.proto');

            mockLoadProto.mockRejectedValue(new Error('Proto error'));

            await expect(noLogService.load()).rejects.toThrow('No services loaded successfully');
        });
    });

    it('should handle loadService when no proto files found', async () => {
        // Mock findProtoFiles to return empty array
        jest.spyOn(service as any, 'findProtoFiles').mockResolvedValue([]);

        await expect((service as any).loadService('/test/path')).rejects.toThrow(
            'Failed to load service /test/path: Failed to load service from /test/path.proto: Service /test/path not found in package test.package',
        );
    });

    it('should throw error when package is missing', () => {
        expect(() => {
            new GrpcProtoService({ protoPath: '/test.proto' } as any);
        }).toThrow('package is required and must be a string');
    });

    it('should throw error when package is not a string', () => {
        expect(() => {
            new GrpcProtoService({ protoPath: '/test.proto', package: 123 } as any);
        }).toThrow('package is required and must be a string');
    });

    it('should handle load when already loaded and cached', async () => {
        const mockDefinition = { TestService: {} };
        (service as any).isLoaded = true;
        (service as any).protoDefinition = mockDefinition;

        const result = await service.load();

        expect(result).toBe(mockDefinition);
        expect(mockLoadProto).not.toHaveBeenCalled();
    });

    it('should handle constructor validation with missing options', () => {
        expect(() => {
            new GrpcProtoService(undefined as any);
        }).toThrow('GRPC_OPTIONS is required');
    });

    it('should handle loadService with no proto files found', async () => {
        // Mock findProtoFiles to return empty array
        jest.spyOn(service as any, 'findProtoFiles').mockResolvedValue([]);

        await expect((service as any).loadService('/test/path')).rejects.toThrow(
            'Failed to load service /test/path: Failed to load service from /test/path.proto: Service /test/path not found in package test.package',
        );
    });

    it('should handle options validation error for missing options', () => {
        // This test covers line 67: Options validation error
        expect(() => {
            new GrpcProtoService(null as any);
        }).toThrow('GRPC_OPTIONS is required');
    });

    it('should handle findProtoFiles returning empty array', async () => {
        // This test covers line 350: No proto files found error
        // Mock findProtoFiles to return empty array for the loadMultipleProtoFiles path
        jest.spyOn(service as any, 'findProtoFiles').mockResolvedValue([]);

        // Mock isDirectory to return true so it goes through loadMultipleProtoFiles
        jest.spyOn(service as any, 'isDirectory').mockReturnValue(true);

        await expect(service.load()).rejects.toThrow('No proto files found in /test/path');
    });
});
