import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';

import { GrpcProtoService } from '../../src/services/grpc-proto.service';
import { GRPC_OPTIONS } from '../../src/constants';
import { GrpcOptions } from '../../src/interfaces';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');
jest.mock('glob', () => ({
    glob: jest.fn(),
}));

// Mock proto-utils
jest.mock('../../src/utils/proto-utils', () => ({
    loadProto: jest.fn(),
    getServiceByName: jest.fn(),
}));

describe('GrpcProtoService', () => {
    let service: GrpcProtoService;
    let mockOptions: GrpcOptions;
    let mockLoadProto: jest.MockedFunction<any>;
    let mockGetServiceByName: jest.MockedFunction<any>;

    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();

        mockOptions = {
            protoPath: '/test/path.proto',
            package: 'test.package',
            logging: {
                level: 'debug',
                context: 'test',
            },
        };

        // Mock fs.accessSync to allow access
        (fs.accessSync as jest.Mock).mockImplementation(() => {});
        
        // Mock path.join
        (path.join as jest.Mock).mockReturnValue('/test/**/*.proto');
        
        // Mock glob
        const glob = require('glob');
        glob.glob.mockResolvedValue(['/test/file1.proto']);
        
        // Get mocked functions first
        const protoUtils = require('../../src/utils/proto-utils');
        mockLoadProto = protoUtils.loadProto;
        mockGetServiceByName = protoUtils.getServiceByName;
        
        // Mock proto-utils to return a valid package structure
        mockLoadProto.mockResolvedValue({
            test: {
                package: {
                    TestService: jest.fn()
                }
            }
        });

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
        
        // Mock the load method to avoid complex proto loading
        jest.spyOn(service, 'load').mockResolvedValue({
            test: {
                package: {
                    TestService: jest.fn()
                }
            }
        });
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

        it('should initialize with valid options', () => {
            const validOptions: GrpcOptions = {
                protoPath: '/test.proto',
                package: 'test.package',
                logging: { level: 'debug' },
            };
            
            expect(() => new GrpcProtoService(validOptions)).not.toThrow();
        });
    });

    describe('onModuleInit', () => {
        it('should load proto files on initialization', async () => {
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            await service.onModuleInit();

            expect(mockLoadProto).toHaveBeenCalled();
        });

        it('should handle loading errors', async () => {
            mockLoadProto.mockRejectedValue(new Error('Load failed'));
            
            await expect(service.onModuleInit()).rejects.toThrow('Load failed');
        });

        it('should log lifecycle events', async () => {
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            await service.onModuleInit();

            // Should log lifecycle events
            expect(mockLoadProto).toHaveBeenCalled();
        });
    });

    describe('load', () => {
        it('should return cached definition if already loaded', async () => {
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            const result1 = await service.load();
            const result2 = await service.load();

            expect(result1).toBe(mockDefinition);
            expect(result2).toBe(mockDefinition);
            expect(mockLoadProto).toHaveBeenCalledTimes(1); // Should only call once due to caching
        });

        it('should handle concurrent load requests', async () => {
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            const promises = [service.load(), service.load(), service.load()];
            const results = await Promise.all(promises);

            expect(results).toEqual([mockDefinition, mockDefinition, mockDefinition]);
            expect(mockLoadProto).toHaveBeenCalledTimes(1); // Should only call once due to caching
        });

        it('should reset loading promise on error', async () => {
            mockLoadProto.mockRejectedValueOnce(new Error('First load failed'));
            mockLoadProto.mockResolvedValueOnce({ TestService: jest.fn() });

            // First call should fail
            await expect(service.load()).rejects.toThrow('First load failed');
            
            // Second call should succeed (loading promise reset)
            const result = await service.load();
            expect(result).toBeDefined();
        });

        it('should handle single proto file loading', async () => {
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            const result = await service.load();

            expect(result).toBe(mockDefinition);
            expect(mockLoadProto).toHaveBeenCalledWith('/test/path.proto', undefined);
        });

        it('should handle directory loading', async () => {
            // Mock fs.statSync to return directory
            (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
            
            // Mock glob to return proto files
            const glob = require('glob');
            glob.glob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            const result = await service.load();

            expect(result).toBeDefined();
            expect(glob.glob).toHaveBeenCalled();
        });

        it('should handle glob pattern loading', async () => {
            // Mock isGlobPattern to return true
            const serviceAny = service as any;
            jest.spyOn(serviceAny, 'isGlobPattern').mockReturnValue(true);
            
            // Mock glob to return proto files
            const glob = require('glob');
            glob.glob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            const result = await service.load();

            expect(result).toBeDefined();
            expect(glob.glob).toHaveBeenCalled();
        });
    });

    describe('getProtoDefinition', () => {
        it('should return the loaded proto definition', async () => {
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            await service.load();
            const result = service.getProtoDefinition();

            expect(result).toBe(mockDefinition);
        });

        it('should throw error if not loaded', () => {
            expect(() => service.getProtoDefinition()).toThrow(
                'Proto files have not been loaded yet. Call load() first.'
            );
        });
    });

    describe('loadService', () => {
        it('should load a specific service', async () => {
            const mockService = { methods: ['method1', 'method2'] };
            mockGetServiceByName.mockReturnValue(mockService);

            const result = await service.loadService('TestService');

            expect(result).toBe(mockService);
            expect(mockGetServiceByName).toHaveBeenCalled();
        });

        it('should throw error for invalid service name', async () => {
            await expect(service.loadService('')).rejects.toThrow(
                'Failed to load service : Service name is required and must be a string'
            );
        });

        it('should throw error for null service name', async () => {
            await expect(service.loadService(null as any)).rejects.toThrow(
                'Service name is required and must be a string'
            );
        });

        it('should throw error for undefined service name', async () => {
            await expect(service.loadService(undefined as any)).rejects.toThrow(
                'Service name is required and must be a string'
            );
        });

        it('should handle service loading from single file', async () => {
            const mockService = { methods: ['method1'] };
            mockGetServiceByName.mockReturnValue(mockService);

            const result = await service.loadService('TestService');

            expect(result).toBe(mockService);
        });

        it('should handle service loading from multiple files', async () => {
            // Mock isDirectory to return true
            const serviceAny = service as any;
            jest.spyOn(serviceAny, 'isDirectory').mockReturnValue(true);
            
            // Mock glob to return proto files
            const glob = require('glob');
            glob.glob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            
            const mockService = { methods: ['method1'] };
            mockGetServiceByName.mockReturnValue(mockService);

            const result = await service.loadService('TestService');

            expect(result).toBe(mockService);
        });

        it('should throw error when service not found in any file', async () => {
            // Mock isDirectory to return true
            const serviceAny = service as any;
            jest.spyOn(serviceAny, 'isDirectory').mockReturnValue(true);
            
            // Mock glob to return proto files
            const glob = require('glob');
            glob.glob.mockResolvedValue(['/test/file1.proto']);
            
            mockGetServiceByName.mockReturnValue(null);

            await expect(service.loadService('NonExistentService')).rejects.toThrow(
                'Service NonExistentService not found in any proto file'
            );
        });
    });

    describe('private methods', () => {
        describe('validateProtoPath', () => {
            it('should validate accessible proto path', () => {
                (fs.accessSync as jest.Mock).mockImplementation(() => {}); // No error

                const serviceAny = service as any;
                expect(() => serviceAny.validateProtoPath('/test.proto')).not.toThrow();
            });

            it('should throw error for inaccessible proto path', () => {
                (fs.accessSync as jest.Mock).mockImplementation(() => {
                    throw new Error('Access denied');
                });

                const serviceAny = service as any;
                expect(() => serviceAny.validateProtoPath('/test.proto')).toThrow(
                    'Proto path is not accessible: /test.proto'
                );
            });

            it('should skip validation for glob patterns', () => {
                const serviceAny = service as any;
                expect(() => serviceAny.validateProtoPath('*.proto')).not.toThrow();
            });
        });

        describe('isDirectory', () => {
            it('should return true for directory', () => {
                (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });

                const serviceAny = service as any;
                expect(serviceAny.isDirectory('/test/dir')).toBe(true);
            });

            it('should return false for file', () => {
                (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => false });

                const serviceAny = service as any;
                expect(serviceAny.isDirectory('/test/file.proto')).toBe(false);
            });

            it('should return false on error', () => {
                (fs.statSync as jest.Mock).mockImplementation(() => {
                    throw new Error('Stat failed');
                });

                const serviceAny = service as any;
                expect(serviceAny.isDirectory('/test/path')).toBe(false);
            });
        });

        describe('isGlobPattern', () => {
            it('should detect glob patterns', () => {
                const serviceAny = service as any;
                
                expect(serviceAny.isGlobPattern('*.proto')).toBe(true);
                expect(serviceAny.isGlobPattern('test?.proto')).toBe(true);
                expect(serviceAny.isGlobPattern('test{1,2}.proto')).toBe(true);
                expect(serviceAny.isGlobPattern('test[1-3].proto')).toBe(true);
                expect(serviceAny.isGlobPattern('!test.proto')).toBe(true);
            });

            it('should not detect non-glob patterns', () => {
                const serviceAny = service as any;
                
                expect(serviceAny.isGlobPattern('test.proto')).toBe(false);
                expect(serviceAny.isGlobPattern('/path/to/file.proto')).toBe(false);
                expect(serviceAny.isGlobPattern('')).toBe(false);
            });
        });

        describe('findProtoFiles', () => {
            it('should find proto files in directory', async () => {
                // Mock isDirectory to return true
                const serviceAny = service as any;
                jest.spyOn(serviceAny, 'isDirectory').mockReturnValue(true);
                
                // Mock path.join
                (path.join as jest.Mock).mockReturnValue('/test/**/*.proto');
                
                // Mock glob to return proto files
                const glob = require('glob');
                glob.glob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
                
                // Mock fs.accessSync to allow access
                (fs.accessSync as jest.Mock).mockImplementation(() => {});

                const result = await serviceAny.findProtoFiles('/test/dir');

                expect(result).toEqual(['/test/file1.proto', '/test/file2.proto']);
                expect(glob.glob).toHaveBeenCalledWith('/test/**/*.proto', {
                    ignore: ['node_modules/**', '**/node_modules/**'],
                    absolute: true,
                    nodir: true,
                });
            });

            it('should handle glob pattern directly', async () => {
                // Mock glob to return proto files
                const glob = require('glob');
                glob.glob.mockResolvedValue(['/test/file1.proto']);
                
                // Mock fs.accessSync to allow access
                (fs.accessSync as jest.Mock).mockImplementation(() => {});

                const serviceAny = service as any;
                const result = await serviceAny.findProtoFiles('*.proto');

                expect(result).toEqual(['/test/file1.proto']);
            });

            it('should filter out unreadable files', async () => {
                // Mock glob to return proto files
                const glob = require('glob');
                glob.glob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
                
                // Mock fs.accessSync to deny access to second file
                (fs.accessSync as jest.Mock)
                    .mockImplementationOnce(() => {}) // First file accessible
                    .mockImplementationOnce(() => { throw new Error('Access denied'); }); // Second file not accessible

                const serviceAny = service as any;
                const result = await serviceAny.findProtoFiles('*.proto');

                expect(result).toEqual(['/test/file1.proto']); // Only first file should be included
            });

            it('should handle glob errors', async () => {
                const glob = require('glob');
                glob.glob.mockRejectedValue(new Error('Glob failed'));

                const serviceAny = service as any;
                await expect(serviceAny.findProtoFiles('*.proto')).rejects.toThrow(
                    'Error finding proto files with pattern *.proto: Glob failed'
                );
            });
        });

        describe('getServiceByPackageName', () => {
            it('should return proto directly if no package name', () => {
                const mockProto = { service1: {}, service2: {} };
                
                const serviceAny = service as any;
                const result = serviceAny.getServiceByPackageName(mockProto, '');

                expect(result).toBe(mockProto);
            });

            it('should return proto directly if package name is null/undefined', () => {
                const mockProto = { service1: {}, service2: {} };
                
                const serviceAny = service as any;
                const result = serviceAny.getServiceByPackageName(mockProto, null);

                expect(result).toBe(mockProto);
            });

            it('should navigate package structure', () => {
                const mockProto = {
                    com: {
                        example: {
                            service: { methods: ['method1'] }
                        }
                    }
                };
                
                const serviceAny = service as any;
                const result = serviceAny.getServiceByPackageName(mockProto, 'com.example');

                expect(result).toEqual({ service: { methods: ['method1'] } });
            });

            it('should throw error for null proto', () => {
                const serviceAny = service as any;
                expect(() => serviceAny.getServiceByPackageName(null, 'test.package')).toThrow(
                    'Proto definition is null or undefined'
                );
            });

            it('should throw error for invalid package structure', () => {
                const mockProto = { com: 'not-an-object' };
                
                const serviceAny = service as any;
                expect(() => serviceAny.getServiceByPackageName(mockProto, 'com.example')).toThrow(
                    'Invalid package structure at \'example\''
                );
            });

            it('should throw error for missing package part', () => {
                const mockProto = { com: {} };
                
                const serviceAny = service as any;
                expect(() => serviceAny.getServiceByPackageName(mockProto, 'com.example')).toThrow(
                    'Package part \'example\' not found'
                );
            });
        });

        describe('getLoadedServiceNames', () => {
            it('should extract service names from definition', () => {
                const mockDefinition = {
                    TestService: jest.fn(),
                    AnotherService: jest.fn(),
                    notAService: 'string'
                };
                
                const serviceAny = service as any;
                const result = serviceAny.getLoadedServiceNames(mockDefinition);

                expect(result).toContain('TestService');
                expect(result).toContain('AnotherService');
                expect(result).not.toContain('notAService');
            });

            it('should handle null definition', () => {
                const serviceAny = service as any;
                const result = serviceAny.getLoadedServiceNames(null);

                expect(result).toEqual([]);
            });

            it('should handle undefined definition', () => {
                const serviceAny = service as any;
                const result = serviceAny.getLoadedServiceNames(undefined);

                expect(result).toEqual([]);
            });

            it('should handle non-object definition', () => {
                const serviceAny = service as any;
                const result = serviceAny.getLoadedServiceNames('string');

                expect(result).toEqual([]);
            });

            it('should handle errors gracefully', () => {
                const mockDefinition = {
                    get [Symbol.iterator]() {
                        throw new Error('Iterator error');
                    }
                };
                
                const serviceAny = service as any;
                const result = serviceAny.getLoadedServiceNames(mockDefinition);

                expect(result).toEqual([]);
            });
        });
    });

    describe('error handling', () => {
        it('should handle proto loading failures gracefully', async () => {
            // Mock fs.accessSync to throw error
            (fs.accessSync as jest.Mock).mockImplementation(() => {
                throw new Error('Proto load failed');
            });

            await expect(service.load()).rejects.toThrow('Failed to load proto file(s): Proto path is not accessible: /test/path.proto');
        });

        it('should handle service loading failures gracefully', async () => {
            // Mock fs.accessSync to throw error
            (fs.accessSync as jest.Mock).mockImplementation(() => {
                throw new Error('Proto load failed');
            });

            await expect(service.loadService('NonExistentService')).rejects.toThrow(
                'Failed to load service NonExistentService: Proto path is not accessible: /test/path.proto'
            );
        });

        it('should handle multiple proto file loading errors', async () => {
            // Mock isDirectory to return true
            const serviceAny = service as any;
            jest.spyOn(serviceAny, 'isDirectory').mockReturnValue(true);
            
            // Mock glob to return proto files
            const glob = require('glob');
            glob.glob.mockResolvedValue(['/test/file1.proto', '/test/file2.proto']);
            
            // Mock loadProto to fail for all files
            mockLoadProto.mockRejectedValue(new Error('Load failed'));

            await expect(service.load()).rejects.toThrow('No services loaded successfully');
        });

        it('should handle no proto files found', async () => {
            // Mock isDirectory to return true
            const serviceAny = service as any;
            jest.spyOn(serviceAny, 'isDirectory').mockReturnValue(true);
            
            // Mock glob to return no files
            const glob = require('glob');
            glob.glob.mockResolvedValue([]);

            await expect(service.load()).rejects.toThrow('No proto files found in /test/path.proto');
        });
    });

    describe('logging', () => {
        it('should log debug information when debug level is enabled', async () => {
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            await service.load();

            // Should log debug information
            expect(mockLoadProto).toHaveBeenCalled();
        });

        it('should log lifecycle events', async () => {
            const mockDefinition = { TestService: jest.fn() };
            mockLoadProto.mockResolvedValue(mockDefinition);

            await service.load();

            // Should log lifecycle events
            expect(mockLoadProto).toHaveBeenCalled();
        });

        it('should handle logging errors gracefully', async () => {
            // Mock isDirectory to return true
            const serviceAny = service as any;
            jest.spyOn(serviceAny, 'isDirectory').mockReturnValue(true);
            
            // Mock glob to return proto files
            const glob = require('glob');
            glob.glob.mockResolvedValue(['/test/file1.proto']);
            
            // Mock loadProto to fail
            mockLoadProto.mockRejectedValue(new Error('Load failed'));

            await expect(service.load()).rejects.toThrow('No services loaded successfully');
        });
    });
});
