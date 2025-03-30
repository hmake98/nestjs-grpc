import { Injectable, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import { Observable } from 'rxjs';
import { ProtoLoaderService } from './proto-loader.service';
import { GRPC_OPTIONS, GRPC_LOGGER } from '../constants';
import { GrpcOptions } from '../interfaces/grpc-options.interface';
import { GrpcClientOptions } from '../interfaces/grpc-client-options.interface';
import { GrpcLogger } from '../interfaces/logger.interface';
import {
    createClientCredentials,
    createChannelOptions,
    getServiceMethods,
} from '../utils/proto-utils';

@Injectable()
export class GrpcClientFactory implements OnModuleInit {
    constructor(
        @Inject(GRPC_OPTIONS) private readonly options: GrpcOptions,
        @Inject(GRPC_LOGGER) private readonly logger: GrpcLogger,
        private readonly protoLoaderService: ProtoLoaderService,
    ) {}

    private clients: Map<string, any> = new Map();
    private protoServices: any;

    /**
     * Initialize the factory on module initialization
     */
    async onModuleInit(): Promise<void> {
        try {
            this.protoServices = await this.protoLoaderService.load();
            this.logger.info('gRPC services loaded successfully');

            // Log available services for debugging
            if (this.protoServices) {
                const serviceNames = Object.keys(this.protoServices).filter(
                    key => typeof this.protoServices[key] === 'function',
                );
                this.logger.debug(
                    `Available services: ${serviceNames.join(', ')}`,
                    'GrpcClientFactory',
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to load gRPC services: ${error.message}`,
                'GrpcClientFactory',
                error.stack,
            );
            throw error;
        }
    }

    /**
     * Creates a gRPC client for a service
     * @param serviceName The service name
     * @param options The client options
     * @returns The client instance
     */
    create<T>(serviceName: string, options?: Partial<GrpcClientOptions>): T {
        const clientKey = this.getClientKey(serviceName, options?.url);

        if (this.clients.has(clientKey)) {
            this.logger.debug(`Reusing existing client for ${serviceName}`);
            return this.clients.get(clientKey);
        }

        const serviceConstructor = this.getServiceConstructor(serviceName);
        const clientOptions = this.mergeClientOptions(options);
        const client = this.createClient(serviceConstructor, clientOptions);

        // Store the client for reuse
        this.clients.set(clientKey, client);
        this.logger.debug(`Created new client for ${serviceName} at ${clientOptions.url}`);

        return client as T;
    }

    /**
     * Gets a key for the client cache
     * @param serviceName The service name
     * @param url The service URL
     * @returns The cache key
     */
    private getClientKey(serviceName: string, url?: string): string {
        return `${serviceName}:${url || this.options.url || 'default'}`;
    }

    /**
     * Gets the service constructor
     * @param serviceName The service name (can include package prefix)
     * @returns The service constructor
     */
    private getServiceConstructor(serviceName: string): any {
        if (!this.protoServices) {
            this.logger.error('gRPC services not loaded yet', 'GrpcClientFactory');
            throw new Error('gRPC services not loaded yet');
        }

        // Try to get the service directly
        let serviceConstructor = this.protoServices[serviceName];

        // If not found, handle potential package prefix
        if (!serviceConstructor && serviceName.includes('.')) {
            // Service name might include a package prefix (e.g., 'user.UserService')
            // Try to navigate through the package structure
            const parts = serviceName.split('.');
            let current = this.protoServices;

            // Navigate through each part of the path
            for (const part of parts) {
                if (!current[part]) {
                    break;
                }
                current = current[part];
            }

            // If we found a constructor at the end, use it
            if (typeof current === 'function') {
                serviceConstructor = current;
            }
        }

        // If still not found, try looking for just the service name without package
        if (!serviceConstructor) {
            const shortServiceName = serviceName.split('.').pop();
            if (!shortServiceName) {
                throw new Error('Invalid service name');
            }
            this.logger.debug(
                `Trying short service name: ${shortServiceName}`,
                'GrpcClientFactory',
            );

            // Look for the service name anywhere in the loaded services
            const findServiceRecursively = (obj: any, name: string): any => {
                if (!obj || typeof obj !== 'object') return null;

                // If this is the service we're looking for
                if (obj[name] && typeof obj[name] === 'function') {
                    return obj[name];
                }

                // Search nested objects
                for (const key in obj) {
                    if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                        const found = findServiceRecursively(obj[key], name);
                        if (found) return found;
                    }
                }

                return null;
            };

            serviceConstructor = findServiceRecursively(this.protoServices, shortServiceName);
        }

        if (!serviceConstructor) {
            // Log available services to help debugging
            const availableServices = this.getAvailableServices(this.protoServices);
            this.logger.error(
                `Service ${serviceName} not found. Available services: ${availableServices.join(', ')}`,
                'GrpcClientFactory',
            );
            throw new Error(`Service ${serviceName} not found`);
        }

        return serviceConstructor;
    }

    /**
     * Gets a list of available service names recursively
     * @param obj The object to search
     * @param prefix The current path prefix
     * @returns Array of service names
     */
    private getAvailableServices(obj: any, prefix = ''): string[] {
        if (!obj || typeof obj !== 'object') return [];

        let services: string[] = [];

        // Iterate over all properties
        for (const key in obj) {
            if (!obj.hasOwnProperty(key)) continue;

            const value = obj[key];
            const path = prefix ? `${prefix}.${key}` : key;

            // If it's a constructor function, it's likely a service
            if (typeof value === 'function') {
                services.push(path);
            }
            // If it's an object, recurse
            else if (typeof value === 'object' && value !== null) {
                services = services.concat(this.getAvailableServices(value, path));
            }
        }

        return services;
    }

    /**
     * Merges client options with defaults
     * @param options The client options
     * @returns The merged options
     */
    private mergeClientOptions(options?: Partial<GrpcClientOptions>): GrpcClientOptions {
        return {
            service: options?.service || '',
            package: options?.package || this.options.package,
            protoPath: options?.protoPath || this.options.protoPath,
            url: options?.url || this.options.url || 'localhost:50051',
            maxRetries: options?.maxRetries || 5,
            retryDelay: options?.retryDelay || 100,
            secure: options?.secure || this.options.secure || false,
            rootCerts: options?.rootCerts || this.options.rootCerts,
            privateKey: options?.privateKey || this.options.privateKey,
            certChain: options?.certChain || this.options.certChain,
            timeout: options?.timeout || 30000,
            channelOptions: options?.channelOptions,
            credentials: options?.credentials,
        };
    }

    /**
     * Creates a gRPC client
     * @param serviceConstructor The service constructor
     * @param options The client options
     * @returns The client instance
     */
    private createClient(serviceConstructor: any, options: GrpcClientOptions): any {
        const { url, secure, rootCerts, privateKey, certChain } = options;

        // Create credentials
        const credentials = createClientCredentials(secure, rootCerts, privateKey, certChain);

        // Create channel options
        const channelOptions = createChannelOptions(
            this.options.maxSendMessageSize,
            this.options.maxReceiveMessageSize,
            undefined,
            undefined,
            options.channelOptions,
        );

        this.logger.verbose(
            `Creating gRPC client for ${url} with secure=${secure}`,
            'GrpcClientFactory',
        );

        // Create gRPC client
        const client = new serviceConstructor(url, credentials, channelOptions);

        // Promisify and add metadata handling
        return this.wrapClient(client, options);
    }

    /**
     * Wraps a gRPC client with promise and observable support
     * @param client The raw gRPC client
     * @param options The client options
     * @returns The wrapped client
     */
    private wrapClient(client: any, options: GrpcClientOptions): any {
        const wrappedClient: Record<string, any> = {};
        const methods = getServiceMethods(client.constructor);

        for (const methodName of methods) {
            const originalMethod = client[methodName];

            if (!originalMethod || typeof originalMethod !== 'function') {
                continue;
            }

            // Check if method is a streaming method
            const isStreamingMethod = this.isStreamingMethod(client.constructor, methodName);

            if (isStreamingMethod) {
                // Streaming method - return an Observable
                wrappedClient[methodName] = this.wrapStreamingMethod(client, methodName, options);
                this.logger.verbose(`Wrapped streaming method: ${methodName}`, 'GrpcClientFactory');
            } else {
                // Unary method - return a Promise
                wrappedClient[methodName] = this.wrapUnaryMethod(client, methodName, options);
                this.logger.verbose(`Wrapped unary method: ${methodName}`, 'GrpcClientFactory');
            }
        }

        return wrappedClient;
    }

    /**
     * Checks if a method is a streaming method
     * @param serviceConstructor The service constructor
     * @param methodName The method name
     * @returns True if it's a streaming method
     */
    private isStreamingMethod(serviceConstructor: any, methodName: string): boolean {
        if (!serviceConstructor.service || !serviceConstructor.service.methods) {
            return false;
        }

        const methodDefinition = serviceConstructor.service.methods[methodName];
        return (
            methodDefinition && (methodDefinition.requestStream || methodDefinition.responseStream)
        );
    }

    /**
     * Wraps a unary (non-streaming) method to return a Promise
     * @param client The raw gRPC client
     * @param methodName The method name
     * @param options The client options
     * @returns The wrapped method
     */
    private wrapUnaryMethod(
        client: any,
        methodName: string,
        options: GrpcClientOptions,
    ): (request: any, metadata?: grpc.Metadata) => Promise<any> {
        return (request: any, metadata?: grpc.Metadata): Promise<any> => {
            const meta = this.createMetadata(metadata, options);

            return new Promise<any>((resolve, reject) => {
                const deadline = this.getDeadline(options.timeout);
                this.logger.debug(`Calling unary method ${methodName}`, 'GrpcClientFactory');

                client[methodName](
                    request,
                    meta,
                    { deadline },
                    (error: Error | null, response: any) => {
                        if (error) {
                            this.logger.error(
                                `Error calling ${methodName}: ${error.message}`,
                                'GrpcClientFactory',
                            );
                            reject(error);
                        } else {
                            this.logger.debug(
                                `Successfully called ${methodName}`,
                                'GrpcClientFactory',
                            );
                            resolve(response);
                        }
                    },
                );
            });
        };
    }

    /**
     * Wraps a streaming method to return an Observable
     * @param client The raw gRPC client
     * @param methodName The method name
     * @param options The client options
     * @returns The wrapped method
     */
    private wrapStreamingMethod(
        client: any,
        methodName: string,
        options: GrpcClientOptions,
    ): (request: any, metadata?: grpc.Metadata) => Observable<any> {
        return (request: any, metadata?: grpc.Metadata): Observable<any> => {
            const meta = this.createMetadata(metadata, options);
            this.logger.debug(`Calling streaming method ${methodName}`, 'GrpcClientFactory');

            return new Observable(observer => {
                const deadline = this.getDeadline(options.timeout);
                const call = client[methodName](request, meta, { deadline });

                call.on('data', (data: any) => {
                    this.logger.verbose(`Received data from ${methodName}`, 'GrpcClientFactory');
                    observer.next(data);
                });

                call.on('end', () => {
                    this.logger.debug(`Stream ended for ${methodName}`, 'GrpcClientFactory');
                    observer.complete();
                });

                call.on('error', (error: Error) => {
                    this.logger.error(
                        `Stream error in ${methodName}: ${error.message}`,
                        'GrpcClientFactory',
                    );
                    observer.error(error);
                });

                // Return a cleanup function
                return () => {
                    this.logger.debug(`Cancelling stream for ${methodName}`, 'GrpcClientFactory');
                    call.cancel();
                };
            });
        };
    }

    /**
     * Creates metadata for a gRPC call
     * @param metadata The user-provided metadata
     * @param options The client options
     * @returns The gRPC metadata
     */
    private createMetadata(metadata?: grpc.Metadata, options?: GrpcClientOptions): grpc.Metadata {
        const meta = metadata || new grpc.Metadata();

        // Add authentication if provided
        if (options?.credentials) {
            const { type, token, metadata: authMetadata } = options.credentials;

            if (type === 'jwt' && token) {
                this.logger.verbose('Adding JWT token to metadata', 'GrpcClientFactory');
                meta.add('authorization', `Bearer ${token}`);
            }

            if (authMetadata) {
                this.logger.verbose('Adding custom auth metadata', 'GrpcClientFactory');
                Object.entries(authMetadata).forEach(([key, value]) => {
                    meta.add(key, value);
                });
            }
        }

        return meta;
    }

    /**
     * Gets a deadline timestamp for a gRPC call
     * @param timeout The timeout in milliseconds
     * @returns The deadline timestamp
     */
    private getDeadline(timeout = 30000): number {
        return Date.now() + timeout;
    }
}
