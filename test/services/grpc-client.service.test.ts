import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import { Observable } from 'rxjs';

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
    Metadata: jest.fn().mockImplementation(() => ({
        add: jest.fn(),
    })),
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
                debug: true,
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
            }).toThrow('GRPC_OPTIONS is required');
        });

        it('should throw error if protoPath is missing', () => {
            expect(() => {
                new GrpcClientService({ package: 'test' } as any, mockProtoLoaderService);
            }).toThrow('protoPath is required in gRPC options');
        });

        it('should throw error if package is missing', () => {
            expect(() => {
                new GrpcClientService({ protoPath: '/test.proto' } as any, mockProtoLoaderService);
            }).toThrow('package is required in gRPC options');
        });

        it('should log debug information when debug logging is enabled', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            new GrpcClientService(mockOptions, mockProtoLoaderService);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('onModuleInit', () => {
        it('should initialize cleanup interval', () => {
            jest.spyOn(global, 'setInterval');
            service.onModuleInit();
            expect(setInterval).toHaveBeenCalled();
        });

        it('should throw error if proto loader service is not available', () => {
            const serviceWithoutProto = new GrpcClientService(mockOptions, null as any);
            expect(() => serviceWithoutProto.onModuleInit()).toThrow('ProtoLoaderService is not available');
        });

        it('should handle initialization errors', () => {
            jest.spyOn(global, 'setInterval').mockImplementation(() => {
                throw new Error('setInterval failed');
            });

            expect(() => service.onModuleInit()).toThrow('Failed to initialize GrpcClientService');
        });
    });

    describe('onModuleDestroy', () => {
        it('should cleanup resources', () => {
            jest.spyOn(global, 'clearInterval');
            service.onModuleInit(); // Initialize first
            service.onModuleDestroy();
            expect(clearInterval).toHaveBeenCalled();
        });

        it('should handle stream cancellation errors', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const mockStream = { cancel: jest.fn().mockImplementation(() => { throw new Error('Cancel failed'); }) };
            
            // Access private activeStreams through type assertion
            (service as any).activeStreams.add(mockStream);
            
            service.onModuleDestroy();
            
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error cancelling stream'));
            consoleSpy.mockRestore();
        });

        it('should handle client close errors', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const mockClient = { close: jest.fn().mockImplementation(() => { throw new Error('Close failed'); }) };
            
            // Access private clients through type assertion
            (service as any).clients.set('test-key', { client: mockClient, createdAt: Date.now(), lastUsed: Date.now(), config: 'test', serviceName: 'TestService' });
            
            service.onModuleDestroy();
            
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error closing client'));
            consoleSpy.mockRestore();
        });

        it('should handle cleanup errors gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock clearInterval to throw an error
            jest.spyOn(global, 'clearInterval').mockImplementation(() => {
                throw new Error('clearInterval failed');
            });
            
            service.onModuleDestroy();
            
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error during GrpcClientService cleanup'));
            consoleSpy.mockRestore();
        });
    });

    describe('cleanupStaleClients', () => {
        it('should cleanup stale clients', (done) => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const mockClient = { close: jest.fn() };
            const staleTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
            
            // Access private clients and add a stale client
            (service as any).clients.set('stale-key', {
                client: mockClient,
                createdAt: staleTime,
                lastUsed: staleTime,
                config: 'test',
                serviceName: 'TestService'
            });
            
            service.onModuleInit();
            
            // Wait for cleanup to run
            setTimeout(() => {
                expect(mockClient.close).toHaveBeenCalled();
                expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaned up'));
                consoleSpy.mockRestore();
                done();
            }, 100);
        });

        it('should handle client close errors during cleanup', (done) => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const mockClient = { close: jest.fn().mockImplementation(() => { throw new Error('Close failed'); }) };
            const staleTime = Date.now() - 10 * 60 * 1000;
            
            (service as any).clients.set('stale-key', {
                client: mockClient,
                createdAt: staleTime,
                lastUsed: staleTime,
                config: 'test',
                serviceName: 'TestService'
            });
            
            service.onModuleInit();
            
            setTimeout(() => {
                expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error closing stale client'));
                consoleSpy.mockRestore();
                done();
            }, 100);
        });
    });

    describe('getAvailableServices', () => {
        it('should return available services', () => {
            const mockProtoDefinition = {
                TestService: jest.fn(),
                AnotherService: jest.fn(),
                nested: {
                    DeepService: jest.fn(),
                    NotAService: 'string',
                }
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const services = service.getAvailableServices();

            expect(services).toContain('TestService');
            expect(services).toContain('AnotherService');
            expect(services).toContain('nested.DeepService');
        });

        it('should return empty array if no proto definition', () => {
            mockProtoLoaderService.getProtoDefinition.mockReturnValue(null);

            const services = service.getAvailableServices();

            expect(services).toEqual([]);
        });

        it('should handle errors gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            mockProtoLoaderService.getProtoDefinition.mockImplementation(() => {
                throw new Error('Proto not loaded');
            });

            const services = service.getAvailableServices();

            expect(services).toEqual([]);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error getting available services'));
            consoleSpy.mockRestore();
        });

        it('should handle discovery errors', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const circularRef: any = {};
            circularRef.self = circularRef;
            
            mockProtoLoaderService.getProtoDefinition.mockReturnValue({
                TestService: jest.fn(),
                circular: circularRef,
            });

            const services = service.getAvailableServices();

            expect(services).toContain('TestService');
            consoleSpy.mockRestore();
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
        beforeEach(() => {
            const {
                createClientCredentials,
                createChannelOptions,
                getServiceMethods,
            } = require('../../src/utils/proto-utils');

            createClientCredentials.mockReturnValue({});
            createChannelOptions.mockReturnValue({});
            getServiceMethods.mockReturnValue(['testMethod']);
        });

        it('should create a client for a service', () => {
            const mockServiceConstructor = jest.fn().mockReturnValue({
                testMethod: jest.fn(),
                constructor: {
                    service: {
                        methods: {
                            testMethod: { requestStream: false, responseStream: false }
                        }
                    }
                }
            });

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

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

        it('should throw error for invalid options type', () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            expect(() => service.create('TestService', 'invalid' as any)).toThrow(
                'Options must be an object',
            );
        });

        it('should throw error for invalid URL option', () => {
            const mockProtoDefinition = { TestService: jest.fn() };
            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            expect(() => service.create('TestService', { url: 123 } as any)).toThrow(
                'URL option must be a string',
            );
        });

        it('should throw error for non-existent service', () => {
            mockProtoLoaderService.getProtoDefinition.mockReturnValue({});

            expect(() => service.create('NonExistentService')).toThrow('Service lookup failed');
        });

        it('should use cached client for same service and options', () => {
            const mockServiceConstructor = jest.fn().mockReturnValue({
                testMethod: jest.fn(),
                constructor: {
                    service: {
                        methods: {
                            testMethod: { requestStream: false, responseStream: false }
                        }
                    }
                }
            });

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const client1 = service.create('TestService');
            const client2 = service.create('TestService');

            expect(client1).toBe(client2);
            expect(mockServiceConstructor).toHaveBeenCalledTimes(1);
        });

        it('should handle package-prefixed service names', () => {
            const mockServiceConstructor = jest.fn().mockReturnValue({
                testMethod: jest.fn(),
                constructor: {
                    service: {
                        methods: {
                            testMethod: { requestStream: false, responseStream: false }
                        }
                    }
                }
            });

            const mockProtoDefinition = {
                test: {
                    package: {
                        TestService: mockServiceConstructor,
                    }
                }
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const client = service.create('test.package.TestService');

            expect(client).toBeDefined();
        });

        it('should handle service name without package prefix', () => {
            const mockServiceConstructor = jest.fn().mockReturnValue({
                testMethod: jest.fn(),
                constructor: {
                    service: {
                        methods: {
                            testMethod: { requestStream: false, responseStream: false }
                        }
                    }
                }
            });

            const mockProtoDefinition = {
                nested: {
                    TestService: mockServiceConstructor,
                }
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const client = service.create('some.package.TestService');

            expect(client).toBeDefined();
        });

        it('should throw error for invalid service constructor', () => {
            const mockProtoDefinition = {
                TestService: 'not a function',
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            expect(() => service.create('TestService')).toThrow(
                'is not a valid constructor function'
            );
        });

        it('should handle invalid URL in options', () => {
            const mockServiceConstructor = jest.fn().mockImplementation(() => {
                throw new Error('Invalid URL');
            });

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            expect(() => service.create('TestService', { url: '' })).toThrow(
                'Failed to create gRPC client for service TestService'
            );
        });

        it('should handle streaming methods', () => {
            const mockCall = {
                on: jest.fn(),
                cancel: jest.fn(),
            };

            const mockServiceConstructor = jest.fn().mockReturnValue({
                streamMethod: jest.fn().mockReturnValue(mockCall),
                constructor: {
                    service: {
                        methods: {
                            streamMethod: { requestStream: false, responseStream: true }
                        }
                    }
                }
            });

            const { getServiceMethods } = require('../../src/utils/proto-utils');
            getServiceMethods.mockReturnValue(['streamMethod']);

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const client = service.create('TestService') as any;
            
            expect(client.streamMethod).toBeDefined();
            
            // Test streaming method
            const observable = client.streamMethod({ test: 'data' });
            expect(observable).toBeInstanceOf(Observable);
        });

        it('should handle unary method timeout', (done) => {
            const mockCall = {
                on: jest.fn(),
                cancel: jest.fn(),
            };

            const mockServiceConstructor = jest.fn().mockReturnValue({
                unaryMethod: jest.fn().mockImplementation((req, meta, opts, callback) => {
                    // Simulate timeout by not calling callback
                    return mockCall;
                }),
                constructor: {
                    service: {
                        methods: {
                            unaryMethod: { requestStream: false, responseStream: false }
                        }
                    }
                }
            });

            const { getServiceMethods } = require('../../src/utils/proto-utils');
            getServiceMethods.mockReturnValue(['unaryMethod']);

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const client = service.create('TestService', { timeout: 100 }) as any;
            
            client.unaryMethod({ test: 'data' }).catch((error: any) => {
                expect(error.message).toContain('timed out');
                done();
            });
        });

        it('should handle unary method errors', (done) => {
            const mockCall = {
                on: jest.fn(),
                cancel: jest.fn(),
            };

            const mockServiceConstructor = jest.fn().mockReturnValue({
                unaryMethod: jest.fn().mockImplementation((req, meta, opts, callback) => {
                    callback(new Error('gRPC error'), null);
                    return mockCall;
                }),
                constructor: {
                    service: {
                        methods: {
                            unaryMethod: { requestStream: false, responseStream: false }
                        }
                    }
                }
            });

            const { getServiceMethods } = require('../../src/utils/proto-utils');
            getServiceMethods.mockReturnValue(['unaryMethod']);

            const mockProtoDefinition = {
                TestService: mockServiceConstructor,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const client = service.create('TestService') as any;
            
            client.unaryMethod({ test: 'data' }).catch((error: any) => {
                expect(error.message).toContain('gRPC call failed');
                done();
            });
        });

        it('should handle client creation failure', () => {
            const { createClientCredentials } = require('../../src/utils/proto-utils');
            createClientCredentials.mockImplementation(() => {
                throw new Error('Credentials failed');
            });

            const mockServiceConstructor = jest.fn();
            const mockProtoDefinition = { TestService: mockServiceConstructor };
            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            expect(() => service.create('TestService')).toThrow('Client creation failed');
        });

        it('should handle no methods found warning', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const { getServiceMethods } = require('../../src/utils/proto-utils');
            getServiceMethods.mockReturnValue([]);

            const mockServiceConstructor = jest.fn().mockReturnValue({});
            const mockProtoDefinition = { TestService: mockServiceConstructor };
            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            service.create('TestService');

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No methods found'));
            consoleSpy.mockRestore();
        });
    });

    describe('createClientForService', () => {
        it('should create client for service with options', () => {
            const mockServiceConstructor = jest.fn().mockReturnValue({
                testMethod: jest.fn(),
                constructor: {
                    service: {
                        methods: {
                            testMethod: { requestStream: false, responseStream: false }
                        }
                    }
                }
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

    describe('private methods edge cases', () => {
        it('should handle service lookup with null proto definition', () => {
            mockProtoLoaderService.getProtoDefinition.mockReturnValue(null);

            expect(() => service.create('TestService')).toThrow(
                'gRPC services not loaded yet'
            );
        });

        it('should handle findServiceByPath with invalid path', () => {
            const mockProtoDefinition = {
                test: null,
            };

            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            expect(() => service.create('test.invalid.path')).toThrow('Service lookup failed');
        });

        it('should handle option merging with extreme values', () => {
            const mockServiceConstructor = jest.fn().mockReturnValue({
                testMethod: jest.fn(),
                constructor: {
                    service: {
                        methods: {
                            testMethod: { requestStream: false, responseStream: false }
                        }
                    }
                }
            });

            const mockProtoDefinition = { TestService: mockServiceConstructor };
            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const {
                createClientCredentials,
                createChannelOptions,
                getServiceMethods,
            } = require('../../src/utils/proto-utils');

            createClientCredentials.mockReturnValue({});
            createChannelOptions.mockReturnValue({});
            getServiceMethods.mockReturnValue(['testMethod']);

            // Test extreme values get clamped
            const client = service.create('TestService', {
                maxRetries: -5, // Should be clamped to 0
                retryDelay: 10, // Should be clamped to 100
                timeout: 500, // Should be clamped to 1000
            });

            expect(client).toBeDefined();
        });

        it('should handle streaming method timeout and error paths', (done) => {
            const mockCall = {
                on: jest.fn((event, callback) => {
                    if (event === 'error') {
                        setTimeout(() => callback(new Error('Stream error')), 50);
                    }
                }),
                cancel: jest.fn(),
            };

            const mockServiceConstructor = jest.fn().mockReturnValue({
                streamMethod: jest.fn().mockReturnValue(mockCall),
                constructor: {
                    service: {
                        methods: {
                            streamMethod: { requestStream: false, responseStream: true }
                        }
                    }
                }
            });

            const { getServiceMethods } = require('../../src/utils/proto-utils');
            getServiceMethods.mockReturnValue(['streamMethod']);

            const mockProtoDefinition = { TestService: mockServiceConstructor };
            mockProtoLoaderService.getProtoDefinition.mockReturnValue(mockProtoDefinition);

            const client = service.create('TestService', { timeout: 100 }) as any;
            
            const observable = client.streamMethod({ test: 'data' });
            
            observable.subscribe({
                error: (error: any) => {
                    expect(error.message).toContain('gRPC stream error');
                    done();
                }
            });
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

        it('should handle logging errors gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Create service with logging disabled to test error paths
            const serviceWithoutLogging = new GrpcClientService({
                ...mockOptions,
                logging: { logErrors: false }
            }, mockProtoLoaderService);

            mockProtoLoaderService.getProtoDefinition.mockReturnValue({});

            expect(() => serviceWithoutLogging.create('NonExistentService')).toThrow();
            
            // Should not log error when logErrors is false
            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
