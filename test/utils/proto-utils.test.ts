import * as fs from 'fs';
import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as protobuf from 'protobufjs';

import {
    loadProto,
    loadProtoWithProtobuf,
    createChannelOptions,
    createClientCredentials,
    getPackageByName,
    getServiceByName,
    getServiceMethods,
} from '../../src/utils/proto-utils';

import {
    formatMethodName,
    formatFieldName,
    pascalToCamel,
    snakeToCamel,
} from '../../src/utils/type-utils';

// Mock the fs module
jest.mock('fs');
jest.mock('@grpc/grpc-js', () => ({
    credentials: {
        createInsecure: jest.fn(),
        createSsl: jest.fn(),
    },
    loadPackageDefinition: jest.fn(),
}));
jest.mock('@grpc/proto-loader');
jest.mock('protobufjs');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockGrpc = grpc as jest.Mocked<typeof grpc>;
const mockProtoLoader = protoLoader as jest.Mocked<typeof protoLoader>;
const mockProtobuf = protobuf as jest.Mocked<typeof protobuf>;

describe('Proto Utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default fs mocks
        mockFs.accessSync.mockImplementation(() => {});
        mockFs.statSync.mockReturnValue({ isFile: () => true } as any);
    });

    describe('loadProto', () => {
        it('should load proto file successfully', async () => {
            const mockPackageDefinition = { test: 'definition' };
            const mockGrpcObject = { TestService: {} };

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(mockGrpcObject as any);

            const result = await loadProto('/path/to/test.proto');

            expect(mockProtoLoader.load).toHaveBeenCalledWith(
                path.resolve('/path/to/test.proto'),
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
            expect(mockGrpc.loadPackageDefinition).toHaveBeenCalledWith(mockPackageDefinition);
            expect(result).toBe(mockGrpcObject);
        });

        it('should throw error for invalid proto path', async () => {
            await expect(loadProto('')).rejects.toThrow('Proto path must be a non-empty string');
            await expect(loadProto(null as any)).rejects.toThrow(
                'Proto path must be a non-empty string',
            );
        });

        it('should throw error for inaccessible proto file', async () => {
            mockFs.accessSync.mockImplementation(() => {
                throw new Error('ENOENT');
            });

            await expect(loadProto('/nonexistent/path.proto')).rejects.toThrow(
                'Proto file not accessible',
            );
        });

        it('should throw error for non-file proto path', async () => {
            mockFs.statSync.mockReturnValue({ isFile: () => false } as any);

            await expect(loadProto('/path/to/directory')).rejects.toThrow(
                'Proto path is not a file',
            );
        });

        it('should handle proto loading errors', async () => {
            mockProtoLoader.load.mockRejectedValue(new Error('parse error'));

            await expect(loadProto('/path/to/test.proto')).rejects.toThrow(
                'Proto file parse error',
            );
        });

        it('should handle ENOENT errors', async () => {
            mockProtoLoader.load.mockRejectedValue(new Error('ENOENT: no such file'));

            await expect(loadProto('/path/to/test.proto')).rejects.toThrow('Proto file not found');
        });

        it('should handle permission errors', async () => {
            mockProtoLoader.load.mockRejectedValue(new Error('EACCES: permission denied'));

            await expect(loadProto('/path/to/test.proto')).rejects.toThrow(
                'Permission denied accessing proto file',
            );
        });

        it('should accept custom options', async () => {
            const customOptions = { keepCase: false, longs: Number };
            const mockPackageDefinition = { test: 'definition' };
            const mockGrpcObject = { TestService: {} };

            mockProtoLoader.load.mockResolvedValue(mockPackageDefinition as any);
            mockGrpc.loadPackageDefinition.mockReturnValue(mockGrpcObject as any);

            await loadProto('/path/to/test.proto', customOptions);

            expect(mockProtoLoader.load).toHaveBeenCalledWith(
                path.resolve('/path/to/test.proto'),
                expect.objectContaining(customOptions),
            );
        });

        it('should throw error for invalid options', async () => {
            await expect(loadProto('/path/to/test.proto', null as any)).rejects.toThrow(
                'Options must be an object',
            );
            await expect(loadProto('/path/to/test.proto', 'invalid' as any)).rejects.toThrow(
                'Options must be an object',
            );
        });

        it('should throw error for invalid includeDirs', async () => {
            await expect(
                loadProto('/path/to/test.proto', { includeDirs: 'invalid' as any }),
            ).rejects.toThrow('includeDirs must be an array');
        });
    });

    describe('loadProtoWithProtobuf', () => {
        it('should load proto file with protobuf', async () => {
            const mockRoot = {
                resolveAll: jest.fn(),
                lookupService: jest.fn().mockReturnValue({ name: 'TestService' }),
                lookupType: jest.fn().mockReturnValue({ name: 'TestMessage' }),
            };

            mockProtobuf.load.mockResolvedValue(mockRoot as any);

            const result = await loadProtoWithProtobuf('/path/to/test.proto');

            expect(mockProtobuf.load).toHaveBeenCalledWith(path.resolve('/path/to/test.proto'));
            expect(result).toBe(mockRoot);
        });

        it('should throw error for invalid proto path', async () => {
            await expect(loadProtoWithProtobuf('')).rejects.toThrow(
                'Proto path must be a non-empty string',
            );
        });

        it('should handle protobuf loading errors', async () => {
            mockProtobuf.load.mockRejectedValue(new Error('protobuf error'));

            await expect(loadProtoWithProtobuf('/path/to/test.proto')).rejects.toThrow(
                'Failed to load proto with protobufjs',
            );
        });
    });

    describe('createChannelOptions', () => {
        it('should create channel options with defaults', () => {
            const options = createChannelOptions();

            expect(options).toEqual({
                'grpc.keepalive_time_ms': 60000,
                'grpc.keepalive_timeout_ms': 20000,
                'grpc.http2.min_time_between_pings_ms': 60000,
                'grpc.http2.max_pings_without_data': 0,
                'grpc.keepalive_permit_without_calls': 1,
            });
        });

        it('should create channel options with custom sizes', () => {
            const options = createChannelOptions(1024, 2048);

            expect(options).toEqual({
                'grpc.keepalive_time_ms': 60000,
                'grpc.keepalive_timeout_ms': 20000,
                'grpc.http2.min_time_between_pings_ms': 60000,
                'grpc.http2.max_pings_without_data': 0,
                'grpc.keepalive_permit_without_calls': 1,
                'grpc.max_send_message_length': 1024,
                'grpc.max_receive_message_length': 2048,
            });
        });

        it('should merge custom options with defaults', () => {
            const additionalOptions = {
                'custom.option': 'value',
            };

            const options = createChannelOptions(undefined, undefined, additionalOptions);

            expect(options).toEqual({
                'grpc.keepalive_time_ms': 60000,
                'grpc.keepalive_timeout_ms': 20000,
                'grpc.http2.min_time_between_pings_ms': 60000,
                'grpc.http2.max_pings_without_data': 0,
                'grpc.keepalive_permit_without_calls': 1,
                'custom.option': 'value',
            });
        });

        it('should throw error for invalid sizes', () => {
            expect(() => createChannelOptions(-1)).toThrow(
                'maxSendSize must be a positive integer',
            );
            expect(() => createChannelOptions(undefined, -1)).toThrow(
                'maxReceiveSize must be a positive integer',
            );
            expect(() => createChannelOptions(1.5)).toThrow(
                'maxSendSize must be a positive integer',
            );
        });
    });

    describe('createClientCredentials', () => {
        it('should create insecure credentials by default', () => {
            const mockCredentials = {} as any;
            (mockGrpc.credentials.createInsecure as jest.Mock).mockReturnValue(mockCredentials);

            const result = createClientCredentials();

            expect(mockGrpc.credentials.createInsecure).toHaveBeenCalled();
            expect(result).toBe(mockCredentials);
        });

        it('should create insecure credentials when secure=false', () => {
            const mockCredentials = {} as any;
            (mockGrpc.credentials.createInsecure as jest.Mock).mockReturnValue(mockCredentials);

            const result = createClientCredentials(false);

            expect(mockGrpc.credentials.createInsecure).toHaveBeenCalled();
            expect(result).toBe(mockCredentials);
        });

        it('should create SSL credentials when secure=true', () => {
            const mockCredentials = {} as any;
            (mockGrpc.credentials.createSsl as jest.Mock).mockReturnValue(mockCredentials);

            const result = createClientCredentials(true);

            expect(mockGrpc.credentials.createSsl).toHaveBeenCalledWith(null, null, null);
            expect(result).toBe(mockCredentials);
        });

        it('should create SSL credentials with provided certificates', () => {
            const mockCredentials = {} as any;
            const rootCerts = Buffer.from('root-cert');
            const privateKey = Buffer.from('private-key');
            const certChain = Buffer.from('cert-chain');

            (mockGrpc.credentials.createSsl as jest.Mock).mockReturnValue(mockCredentials);

            const result = createClientCredentials(true, rootCerts, privateKey, certChain);

            expect(mockGrpc.credentials.createSsl).toHaveBeenCalledWith(
                rootCerts,
                privateKey,
                certChain,
            );
            expect(result).toBe(mockCredentials);
        });

        it('should throw error for invalid certificate types', () => {
            expect(() => createClientCredentials(true, 'invalid' as any)).toThrow(
                'rootCerts must be a Buffer',
            );
            expect(() => createClientCredentials(true, undefined, 'invalid' as any)).toThrow(
                'privateKey must be a Buffer',
            );
            expect(() =>
                createClientCredentials(true, undefined, undefined, 'invalid' as any),
            ).toThrow('certChain must be a Buffer');
        });
    });

    describe('getPackageByName', () => {
        it('should find package by name', () => {
            const grpcObject = {
                com: {
                    example: {
                        service: { TestService: {} },
                    },
                },
            };

            const result = getPackageByName(grpcObject as any, 'com.example.service');

            expect(result).toBe(grpcObject.com.example.service);
        });

        it('should return null for non-existent package', () => {
            const grpcObject = {
                'com.example.service': { TestService: {} },
            };

            const result = getPackageByName(grpcObject as any, 'com.example.nonexistent');

            expect(result).toBeNull();
        });

        it('should handle empty grpc object', () => {
            const result = getPackageByName({} as any, 'com.example.service');

            expect(result).toBeNull();
        });
    });

    describe('getServiceByName', () => {
        it('should find service by name', () => {
            const testServiceConstructor = function () {};
            const otherServiceConstructor = function () {};

            const grpcObject = {
                com: {
                    example: {
                        TestService: testServiceConstructor,
                        OtherService: otherServiceConstructor,
                    },
                },
            };

            const result = getServiceByName(grpcObject as any, 'com.example', 'TestService');

            expect(result).toBe(testServiceConstructor);
        });

        it('should throw error for non-existent package', () => {
            const grpcObject = {
                com: {
                    example: {
                        TestService: { service: 'definition' },
                    },
                },
            };

            expect(() =>
                getServiceByName(grpcObject as any, 'com.nonexistent', 'TestService'),
            ).toThrow("Failed to get service: Package 'com.nonexistent' not found");
        });

        it('should throw error for non-existent service', () => {
            const testServiceConstructor = function () {};

            const grpcObject = {
                com: {
                    example: {
                        TestService: testServiceConstructor,
                    },
                },
            };

            expect(() =>
                getServiceByName(grpcObject as any, 'com.example', 'NonExistentService'),
            ).toThrow('Failed to get service:');
        });

        it('should handle empty grpc object', () => {
            expect(() => getServiceByName({} as any, 'com.example', 'TestService')).toThrow(
                "Failed to get service: Package 'com.example' not found",
            );
        });
    });

    describe('getServiceMethods', () => {
        it('should get service methods from methods property', () => {
            const serviceConstructor = function () {};
            serviceConstructor.service = {
                methods: {
                    methodA: { originalName: 'methodA' },
                    methodB: { originalName: 'methodB' },
                },
            };

            const result = getServiceMethods(serviceConstructor);

            expect(result).toEqual(['methodA', 'methodB']);
        });

        it('should get service methods from originalName property', () => {
            const serviceConstructor = function () {};
            serviceConstructor.service = {
                originalName: {
                    methodA: { originalName: 'methodA' },
                    methodB: { originalName: 'methodB' },
                },
            };

            const result = getServiceMethods(serviceConstructor);

            expect(result).toEqual(['methodA', 'methodB']);
        });

        it('should return empty array for service without methods', () => {
            const serviceConstructor = function () {};
            serviceConstructor.service = {};

            const result = getServiceMethods(serviceConstructor);

            expect(result).toEqual([]);
        });

        it('should return empty array for invalid service constructor', () => {
            expect(getServiceMethods(null)).toEqual([]);
            expect(getServiceMethods({})).toEqual([]);
            expect(getServiceMethods('invalid')).toEqual([]);
        });
    });
});
