import {
    loadProto,
    loadProtoWithProtobuf,
    getServiceByName,
    getPackageByName,
    getServiceMethods,
    createClientCredentials,
    createChannelOptions,
} from '../../utils/proto-utils';
import * as fs from 'fs';
import * as path from 'path';
import * as protoLoader from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';

jest.mock('fs');
jest.mock('path');
jest.mock('@grpc/proto-loader');
jest.mock('@grpc/grpc-js');
jest.mock('protobufjs');

describe('Proto Utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock path.resolve
        (path.resolve as jest.Mock).mockImplementation(p => p);

        // Mock fs.existsSync
        (fs.existsSync as jest.Mock).mockReturnValue(true);

        // Mock protoLoader.load
        (protoLoader.load as jest.Mock).mockResolvedValue({});

        // Mock grpc.loadPackageDefinition
        (grpc.loadPackageDefinition as jest.Mock).mockReturnValue({});

        // Mock protobuf.load
        (protobuf.load as jest.Mock).mockResolvedValue({});
    });

    describe('loadProto', () => {
        it('should load a proto file with default options', async () => {
            const protoPath = '/path/to/proto/file.proto';
            await loadProto(protoPath);

            expect(fs.existsSync).toHaveBeenCalledWith(protoPath);
            expect(protoLoader.load).toHaveBeenCalledWith(
                protoPath,
                expect.objectContaining({
                    keepCase: true,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true,
                }),
            );
            expect(grpc.loadPackageDefinition).toHaveBeenCalled();
        });

        it('should load a proto file with custom options', async () => {
            const protoPath = '/path/to/proto/file.proto';
            const options = {
                keepCase: false,
                longs: Number,
                enums: Number,
            };

            await loadProto(protoPath, options);

            expect(protoLoader.load).toHaveBeenCalledWith(
                protoPath,
                expect.objectContaining({
                    keepCase: false,
                    longs: Number,
                    enums: Number,
                    defaults: true,
                    oneofs: true,
                }),
            );
        });

        it('should throw an error if proto file not found', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            const protoPath = '/path/to/nonexistent/file.proto';

            await expect(loadProto(protoPath)).rejects.toThrow('Proto file not found');
        });
    });

    describe('loadProtoWithProtobuf', () => {
        it('should load a proto file using protobufjs', async () => {
            const protoPath = '/path/to/proto/file.proto';
            await loadProtoWithProtobuf(protoPath);

            expect(fs.existsSync).toHaveBeenCalledWith(protoPath);
            expect(protobuf.load).toHaveBeenCalledWith(protoPath);
        });

        it('should throw an error if proto file not found', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            const protoPath = '/path/to/nonexistent/file.proto';

            await expect(loadProtoWithProtobuf(protoPath)).rejects.toThrow('Proto file not found');
        });
    });

    describe('getServiceByName', () => {
        it('should get a service by name from a package definition', () => {
            const packageDefinition = {
                test: {
                    TestService: function TestService() {},
                },
            };

            const service = getServiceByName(packageDefinition, 'test', 'TestService');

            expect(service).toBe(packageDefinition.test.TestService);
        });

        it('should throw an error if package not found', () => {
            const packageDefinition = {
                test: {
                    TestService: function TestService() {},
                },
            };

            expect(() => {
                getServiceByName(packageDefinition, 'nonexistent', 'TestService');
            }).toThrow('Package nonexistent not found');
        });

        it('should throw an error if service not found', () => {
            const packageDefinition = {
                test: {
                    TestService: function TestService() {},
                },
            };

            expect(() => {
                getServiceByName(packageDefinition, 'test', 'NonexistentService');
            }).toThrow('Service NonexistentService not found in package test');
        });
    });

    describe('getPackageByName', () => {
        it('should get a package by name from a package definition', () => {
            const packageDefinition = {
                test: {
                    nested: {
                        deep: {},
                    },
                },
            };

            const pkg = getPackageByName(packageDefinition, 'test');
            expect(pkg).toBe(packageDefinition.test);

            const nestedPkg = getPackageByName(packageDefinition, 'test.nested');
            expect(nestedPkg).toBe(packageDefinition.test.nested);

            const deepPkg = getPackageByName(packageDefinition, 'test.nested.deep');
            expect(deepPkg).toBe(packageDefinition.test.nested.deep);
        });

        it('should return null if package not found', () => {
            const packageDefinition = {
                test: {},
            };

            const pkg = getPackageByName(packageDefinition, 'nonexistent');
            expect(pkg).toBeNull();

            const nestedPkg = getPackageByName(packageDefinition, 'test.nonexistent');
            expect(nestedPkg).toBeNull();
        });

        it('should return the root package definition if no package name provided', () => {
            const packageDefinition = {
                test: {},
            };

            const pkg = getPackageByName(packageDefinition, '');
            expect(pkg).toBe(packageDefinition);
        });
    });

    describe('getServiceMethods', () => {
        it('should get service methods from a service constructor with originalName', () => {
            const serviceConstructor = {
                service: {
                    originalName: {
                        GetTest: {},
                        CreateTest: {},
                    },
                },
            };

            const methods = getServiceMethods(serviceConstructor);

            expect(methods).toEqual(['GetTest', 'CreateTest']);
        });

        it('should get service methods from a service constructor with methods', () => {
            const serviceConstructor = {
                service: {
                    methods: {
                        GetTest: {},
                        CreateTest: {},
                    },
                },
            };

            const methods = getServiceMethods(serviceConstructor);

            expect(methods).toEqual(['GetTest', 'CreateTest']);
        });

        it('should return empty array if service has no methods', () => {
            const serviceConstructor = {
                service: {},
            };

            const methods = getServiceMethods(serviceConstructor);

            expect(methods).toEqual([]);
        });

        it('should return empty array if service is not defined', () => {
            const serviceConstructor = {};

            const methods = getServiceMethods(serviceConstructor);

            expect(methods).toEqual([]);
        });
    });

    describe('createClientCredentials', () => {
        it('should create insecure credentials by default', () => {
            (grpc.credentials.createInsecure as jest.Mock).mockReturnValue('insecure-credentials');

            const credentials = createClientCredentials();

            expect(grpc.credentials.createInsecure).toHaveBeenCalled();
            expect(credentials).toBe('insecure-credentials');
        });

        it('should create SSL credentials when secure is true', () => {
            (grpc.credentials.createSsl as jest.Mock).mockReturnValue('ssl-credentials');

            const rootCerts = Buffer.from('root-certs');
            const privateKey = Buffer.from('private-key');
            const certChain = Buffer.from('cert-chain');

            const credentials = createClientCredentials(true, rootCerts, privateKey, certChain);

            expect(grpc.credentials.createSsl).toHaveBeenCalledWith(
                rootCerts,
                privateKey,
                certChain,
            );
            expect(credentials).toBe('ssl-credentials');
        });
    });

    describe('createChannelOptions', () => {
        it('should create channel options with defaults', () => {
            const options = createChannelOptions();

            expect(options).toEqual(
                expect.objectContaining({
                    'grpc.keepalive_time_ms': 60000,
                    'grpc.keepalive_timeout_ms': 20000,
                    'grpc.http2.min_time_between_pings_ms': 60000,
                    'grpc.http2.max_pings_without_data': 0,
                    'grpc.keepalive_permit_without_calls': 1,
                }),
            );
        });

        it('should include message size limits when provided', () => {
            const options = createChannelOptions(8 * 1024 * 1024, 16 * 1024 * 1024);

            expect(options).toEqual(
                expect.objectContaining({
                    'grpc.max_send_message_length': 8 * 1024 * 1024,
                    'grpc.max_receive_message_length': 16 * 1024 * 1024,
                }),
            );
        });

        it('should include additional options when provided', () => {
            const additionalOptions = {
                'grpc.custom.option': 'value',
                'grpc.another.option': 42,
            };

            const options = createChannelOptions(undefined, undefined, additionalOptions);

            expect(options).toEqual(
                expect.objectContaining({
                    'grpc.custom.option': 'value',
                    'grpc.another.option': 42,
                }),
            );
        });

        it('should override default options with additional options', () => {
            const additionalOptions = {
                'grpc.keepalive_time_ms': 30000,
            };

            const options = createChannelOptions(undefined, undefined, additionalOptions);

            expect(options['grpc.keepalive_time_ms']).toBe(30000);
        });
    });
});
