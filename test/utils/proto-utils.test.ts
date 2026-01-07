import * as fs from 'fs';
import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as protobuf from 'protobufjs';

import {
    loadProto,
    loadProtoWithProtobuf,
    getServiceByName,
} from '../../src/utils/proto-utils';

// Mock all external dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('@grpc/grpc-js');
jest.mock('@grpc/proto-loader');
jest.mock('protobufjs');

describe('Proto Utils - Comprehensive Tests', () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    const mockPath = path as jest.Mocked<typeof path>;
    const mockGrpc = grpc as jest.Mocked<typeof grpc>;
    const mockProtoLoader = protoLoader as jest.Mocked<typeof protoLoader>;
    const mockProtobuf = protobuf as jest.Mocked<typeof protobuf>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Set up default mock behavior
        mockPath.resolve.mockImplementation(p => `/absolute${p}`);
        mockFs.accessSync.mockReturnValue(undefined);
        mockFs.statSync.mockReturnValue({ isFile: () => true } as any);
    });

    describe('validateProtoPath (private function tested through loadProto)', () => {
        it('should validate valid proto path', async () => {
            const mockPackageDefinition = { test: 'definition' };
            const mockGrpcObject = { TestService: jest.fn() } as any;

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(mockGrpcObject);

            const result = await loadProto('/test/valid.proto');
            expect(result).toBe(mockGrpcObject);
            expect(mockFs.accessSync).toHaveBeenCalledWith(
                '/absolute/test/valid.proto',
                fs.constants.R_OK,
            );
            expect(mockFs.statSync).toHaveBeenCalledWith('/absolute/test/valid.proto');
        });

        it('should throw error for empty proto path', async () => {
            await expect(loadProto('')).rejects.toThrow('Proto path must be a non-empty string');
        });

        it('should throw error for non-string proto path', async () => {
            await expect(loadProto(null as any)).rejects.toThrow(
                'Proto path must be a non-empty string',
            );
        });

        it('should throw error for inaccessible proto file', async () => {
            mockFs.accessSync.mockImplementation(() => {
                throw new Error('ENOENT');
            });

            await expect(loadProto('/test/nonexistent.proto')).rejects.toThrow(
                'Proto file not accessible',
            );
        });

        it('should throw error if path is not a file', async () => {
            mockFs.statSync.mockReturnValue({ isFile: () => false } as any);

            await expect(loadProto('/test/directory')).rejects.toThrow('Proto path is not a file');
        });
    });

    describe('validateOptions (private function tested through loadProto)', () => {
        it('should use default options when none provided', async () => {
            const mockPackageDefinition = { test: 'definition' };
            const mockGrpcObject = { TestService: jest.fn() } as any;

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(mockGrpcObject);

            await loadProto('/test/valid.proto');

            expect(mockProtoLoader.load).toHaveBeenCalledWith(
                '/absolute/test/valid.proto',
                expect.objectContaining({
                    keepCase: true,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true,
                    arrays: true,
                    objects: true,
                    includeDirs: [],
                }),
            );
        });

        it('should merge user options with defaults', async () => {
            const mockPackageDefinition = { test: 'definition' };
            const mockGrpcObject = { TestService: jest.fn() } as any;

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(mockGrpcObject);

            const customOptions = {
                keepCase: false,
                includeDirs: ['/custom/dir'],
            };

            await loadProto('/test/valid.proto', customOptions);

            expect(mockProtoLoader.load).toHaveBeenCalledWith(
                '/absolute/test/valid.proto',
                expect.objectContaining({
                    keepCase: false,
                    includeDirs: ['/custom/dir'],
                    longs: String, // Should still have defaults
                }),
            );
        });

        it('should throw error for non-object options', async () => {
            await expect(loadProto('/test/valid.proto', 'invalid' as any)).rejects.toThrow(
                'Options must be an object',
            );
        });

        it('should throw error for null options', async () => {
            await expect(loadProto('/test/valid.proto', null as any)).rejects.toThrow(
                'Options must be an object',
            );
        });

        it('should validate includeDirs as array', async () => {
            await expect(
                loadProto('/test/valid.proto', { includeDirs: 'not-an-array' as any }),
            ).rejects.toThrow('includeDirs must be an array');
        });

        it('should handle undefined options parameter (line 84)', async () => {
            const mockPackageDefinition = { test: 'definition' };
            const mockGrpcObject = { TestService: jest.fn() } as any;

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(mockGrpcObject);

            // Call loadProto with explicit undefined to test the default parameter branch
            await loadProto('/test/valid.proto', undefined);

            expect(mockProtoLoader.load).toHaveBeenCalledWith(
                '/absolute/test/valid.proto',
                expect.objectContaining({
                    keepCase: true,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true,
                    arrays: true,
                    objects: true,
                    includeDirs: [],
                }),
            );
        });

        it('should handle missing options parameter to test default parameter (line 84)', async () => {
            const mockPackageDefinition = { test: 'definition' };
            const mockGrpcObject = { TestService: jest.fn() } as any;

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(mockGrpcObject);

            // Setup mock for protobuf.load as well
            const mockRoot = { nested: { TestService: {} } };
            mockProtobuf.load.mockResolvedValue(mockRoot as any);

            // Call loadProtoWithProtobuf without options to trigger default parameter
            const result1 = await loadProtoWithProtobuf('/test/valid.proto');
            expect(result1).toBe(mockRoot);

            // Call loadProto without any second argument to trigger default parameter behavior
            const result2 = await loadProto('/test/valid.proto');

            expect(result2).toBe(mockGrpcObject);
            expect(mockProtoLoader.load).toHaveBeenCalledWith(
                '/absolute/test/valid.proto',
                expect.objectContaining({
                    keepCase: true,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true,
                    arrays: true,
                    objects: true,
                    includeDirs: [],
                }),
            );
        });

        it('should handle multiple parameter combinations for validateOptions (line 84 branch)', async () => {
            const mockPackageDefinition = { test: 'definition' };
            const mockGrpcObject = { TestService: jest.fn() } as any;

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(mockGrpcObject);

            // Multiple ways to call to ensure default parameter branch is covered
            await loadProto('/test/valid.proto', {}); // Empty object
            await loadProto('/test/valid.proto', undefined as any); // Explicit undefined
            await loadProto('/test/valid.proto'); // No second parameter

            expect(mockProtoLoader.load).toHaveBeenCalledTimes(3);
        });
    });

    describe('loadProto', () => {
        it('should successfully load proto file', async () => {
            const mockPackageDefinition = { test: 'definition' };
            const mockGrpcObject = { TestService: jest.fn() } as any;

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(mockGrpcObject);

            const result = await loadProto('/test/valid.proto');

            expect(result).toBe(mockGrpcObject);
            expect(mockProtoLoader.load).toHaveBeenCalledWith(
                '/absolute/test/valid.proto',
                expect.any(Object),
            );
            expect(mockGrpc.loadPackageDefinition).toHaveBeenCalledWith(mockPackageDefinition);
        });

        it('should throw error if package definition is null', async () => {
            mockProtoLoader.load.mockResolvedValue(null as any);

            await expect(loadProto('/test/valid.proto')).rejects.toThrow(
                'Failed to load package definition from proto file',
            );
        });

        it('should throw error if grpc object is null', async () => {
            const mockPackageDefinition = { test: 'definition' };

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(null as any);

            await expect(loadProto('/test/valid.proto')).rejects.toThrow(
                'Failed to create gRPC object from package definition',
            );
        });

        it('should handle ENOENT error', async () => {
            mockProtoLoader.load.mockRejectedValue(new Error('ENOENT: file not found'));

            await expect(loadProto('/test/nonexistent.proto')).rejects.toThrow(
                'Proto file not found: /test/nonexistent.proto',
            );
        });

        it('should handle parse error', async () => {
            mockProtoLoader.load.mockRejectedValue(new Error('parse error: invalid syntax'));

            await expect(loadProto('/test/invalid.proto')).rejects.toThrow(
                'Proto file parse error: parse error: invalid syntax',
            );
        });

        it('should handle permission error', async () => {
            mockProtoLoader.load.mockRejectedValue(new Error('EACCES: permission denied'));

            await expect(loadProto('/test/restricted.proto')).rejects.toThrow(
                'Permission denied accessing proto file: /test/restricted.proto',
            );
        });

        it('should handle generic errors', async () => {
            mockProtoLoader.load.mockRejectedValue(new Error('Generic error'));

            await expect(loadProto('/test/error.proto')).rejects.toThrow(
                'Failed to load proto file: Generic error',
            );
        });
    });

    describe('loadProtoWithProtobuf', () => {
        it('should successfully load proto with protobufjs', async () => {
            const mockRoot = { nested: { TestService: {} } };

            mockProtobuf.load.mockResolvedValue(mockRoot as any);

            const result = await loadProtoWithProtobuf('/test/valid.proto');

            expect(result).toBe(mockRoot);
            expect(mockProtobuf.load).toHaveBeenCalledWith('/absolute/test/valid.proto');
        });

        it('should throw error if protobufjs returns null', async () => {
            mockProtobuf.load.mockResolvedValue(null as any);

            await expect(loadProtoWithProtobuf('/test/valid.proto')).rejects.toThrow(
                'Protobufjs returned null root',
            );
        });

        it('should handle ENOENT error', async () => {
            mockProtobuf.load.mockRejectedValue(new Error('ENOENT: file not found'));

            await expect(loadProtoWithProtobuf('/test/nonexistent.proto')).rejects.toThrow(
                'Proto file not found: /test/nonexistent.proto',
            );
        });

        it('should handle parse error', async () => {
            mockProtobuf.load.mockRejectedValue(new Error('parse error: invalid syntax'));

            await expect(loadProtoWithProtobuf('/test/invalid.proto')).rejects.toThrow(
                'Proto file parse error: parse error: invalid syntax',
            );
        });

        it('should handle generic errors', async () => {
            mockProtobuf.load.mockRejectedValue(new Error('Generic error'));

            await expect(loadProtoWithProtobuf('/test/error.proto')).rejects.toThrow(
                'Failed to load proto with protobufjs: Generic error',
            );
        });
    });

    describe('getServiceByName', () => {
        it('should successfully get service by name', () => {
            const mockService = jest.fn();
            const mockPackage = { TestService: mockService };
            const mockPackageDefinition = { com: { example: mockPackage } } as any;

            const result = getServiceByName(mockPackageDefinition, 'com.example', 'TestService');

            expect(result).toBe(mockService);
        });

        it('should throw error for null package definition', () => {
            expect(() => getServiceByName(null as any, 'com.example', 'TestService')).toThrow(
                'Failed to get service: Package definition must be a valid object',
            );
        });

        it('should throw error for invalid package definition', () => {
            expect(() => getServiceByName('invalid' as any, 'com.example', 'TestService')).toThrow(
                'Failed to get service: Package definition must be a valid object',
            );
        });

        it('should throw error for empty package name', () => {
            const mockPackageDefinition = { TestService: jest.fn() } as any;

            expect(() => getServiceByName(mockPackageDefinition as any, '', 'TestService')).toThrow(
                'Failed to get service: Package name must be a non-empty string',
            );
        });

        it('should throw error for null package name', () => {
            const mockPackageDefinition = { TestService: jest.fn() } as any;

            expect(() =>
                getServiceByName(mockPackageDefinition as any, null as any, 'TestService'),
            ).toThrow('Failed to get service: Package name must be a non-empty string');
        });

        it('should throw error for whitespace-only package name (line 264)', () => {
            const mockPackageDefinition = { TestService: jest.fn() } as any;

            expect(() =>
                getServiceByName(mockPackageDefinition as any, '   ', 'TestService'),
            ).toThrow('Failed to get service: Package name cannot be empty');
        });

        it('should throw error for invalid package name format', () => {
            const mockPackageDefinition = { TestService: jest.fn() } as any;

            expect(() =>
                getServiceByName(mockPackageDefinition as any, 'invalid-package!', 'TestService'),
            ).toThrow('Failed to get service: Package name contains invalid characters');
        });

        it('should throw error for empty service name', () => {
            const mockPackageDefinition = { TestService: jest.fn() } as any;

            expect(() => getServiceByName(mockPackageDefinition as any, 'com.example', '')).toThrow(
                'Failed to get service: Service name must be a non-empty string',
            );
        });

        it('should throw error for null service name', () => {
            const mockPackageDefinition = { TestService: jest.fn() } as any;

            expect(() =>
                getServiceByName(mockPackageDefinition as any, 'com.example', null as any),
            ).toThrow('Failed to get service: Service name must be a non-empty string');
        });

        it('should throw error for whitespace-only service name (line 283)', () => {
            const mockPackageDefinition = { TestService: jest.fn() } as any;

            expect(() =>
                getServiceByName(mockPackageDefinition as any, 'com.example', '   '),
            ).toThrow('Failed to get service: Service name cannot be empty');
        });

        it('should throw error for invalid service name format', () => {
            const mockPackageDefinition = { TestService: jest.fn() } as any;

            expect(() =>
                getServiceByName(mockPackageDefinition as any, 'com.example', 'Invalid-Service!'),
            ).toThrow('Failed to get service: Service name contains invalid characters');
        });

        it('should throw error if package not found', () => {
            const mockPackageDefinition = { other: { service: jest.fn() } };

            expect(() =>
                getServiceByName(mockPackageDefinition as any, 'com.missing', 'TestService'),
            ).toThrow("Failed to get service: Package 'com.missing' not found");
        });

        it('should throw error if service not found in package', () => {
            const mockPackage = { OtherService: jest.fn(), AnotherService: jest.fn() };
            const mockPackageDefinition = { com: { example: mockPackage } };

            expect(() =>
                getServiceByName(mockPackageDefinition as any, 'com.example', 'TestService'),
            ).toThrow(
                "Failed to get service: Service 'TestService' not found in package 'com.example'. Available services: OtherService, AnotherService",
            );
        });

        it('should throw error if service is not a function', () => {
            const mockPackage = { TestService: 'not a function' };
            const mockPackageDefinition = { com: { example: mockPackage } };

            expect(() =>
                getServiceByName(mockPackageDefinition as any, 'com.example', 'TestService'),
            ).toThrow("Failed to get service: 'TestService' is not a valid service constructor");
        });

        it('should handle complex nested package structure', () => {
            const mockService = jest.fn();
            const mockPackageDefinition = {
                com: {
                    example: {
                        auth: {
                            v1: {
                                TestService: mockService,
                            },
                        },
                    },
                },
            };

            const result = getServiceByName(
                mockPackageDefinition as any,
                'com.example.auth.v1',
                'TestService',
            );
            expect(result).toBe(mockService);
        });

        it('should throw error for non-file proto path', async () => {
            mockFs.statSync.mockReturnValue({ isFile: () => false } as any);

            await expect(loadProto('/path/to/directory')).rejects.toThrow(
                'Proto path is not a file',
            );
        });
    });
});
