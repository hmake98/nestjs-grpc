import * as grpc from '@grpc/grpc-js';
import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Observable } from 'rxjs';

import { GRPC_OPTIONS } from '../constants';
import { GrpcOptions, GrpcClientOptions } from '../interfaces';
import {
    createClientCredentials,
    createChannelOptions,
    getServiceMethods,
} from '../utils/proto-utils';

import { ProtoLoaderService } from './proto-loader.service';

interface CachedClient {
    client: any;
    createdAt: number;
    lastUsed: number;
    config: string; // For cache key differentiation
}

@Injectable()
export class GrpcClientService implements OnModuleInit, OnModuleDestroy {
    private readonly clients = new Map<string, CachedClient>();
    private readonly activeStreams = new Set<any>();
    private cleanupInterval?: NodeJS.Timeout;
    private readonly CLIENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute

    constructor(
        @Inject(GRPC_OPTIONS) private readonly options: GrpcOptions,
        private readonly protoLoaderService: ProtoLoaderService,
    ) {
        this.validateOptions();
    }

    /**
     * Validates gRPC options on initialization
     */
    private validateOptions(): void {
        if (!this.options) {
            throw new Error('GRPC_OPTIONS is required');
        }

        if (!this.options.protoPath || typeof this.options.protoPath !== 'string') {
            throw new Error('protoPath is required in gRPC options');
        }

        if (!this.options.package || typeof this.options.package !== 'string') {
            throw new Error('package is required in gRPC options');
        }
    }

    /**
     * Initialize the service on module initialization
     */
    onModuleInit(): void {
        try {
            // Start cleanup interval for client cache
            this.cleanupInterval = setInterval(() => {
                this.cleanupStaleClients();
            }, this.CLEANUP_INTERVAL);

            // Validate proto loader service
            if (!this.protoLoaderService) {
                throw new Error('ProtoLoaderService is not available');
            }
        } catch (error) {
            throw new Error(`Failed to initialize GrpcClientService: ${error.message}`);
        }
    }

    /**
     * Cleanup resources on module destruction
     */
    onModuleDestroy(): void {
        try {
            // Clear cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }

            // Close all active streams
            for (const stream of this.activeStreams) {
                try {
                    if (stream && typeof stream.cancel === 'function') {
                        stream.cancel();
                    }
                } catch (error) {
                    console.warn('Error cancelling stream:', error.message);
                }
            }
            this.activeStreams.clear();

            // Close all clients
            for (const [key, cachedClient] of this.clients) {
                try {
                    if (cachedClient.client && typeof cachedClient.client.close === 'function') {
                        cachedClient.client.close();
                    }
                } catch (error) {
                    console.warn(`Error closing client ${key}:`, error.message);
                }
            }
            this.clients.clear();
        } catch (error) {
            console.error('Error during GrpcClientService cleanup:', error.message);
        }
    }

    /**
     * Cleanup stale clients from cache
     */
    private cleanupStaleClients(): void {
        const now = Date.now();
        const staleCutoff = now - this.CLIENT_CACHE_TTL;

        for (const [key, cachedClient] of this.clients) {
            if (cachedClient.lastUsed < staleCutoff) {
                try {
                    if (cachedClient.client && typeof cachedClient.client.close === 'function') {
                        cachedClient.client.close();
                    }
                } catch (error) {
                    console.warn(`Error closing stale client ${key}:`, error.message);
                } finally {
                    this.clients.delete(key);
                }
            }
        }
    }

    /**
     * Creates a gRPC client for a service with improved error handling and service-specific configuration
     */
    create<T>(serviceName: string, options?: Partial<GrpcClientOptions>): T {
        try {
            this.validateCreateParameters(serviceName, options);

            const clientOptions = this.mergeClientOptions(serviceName, options);
            const clientKey = this.getClientKey(serviceName, clientOptions);
            const cachedClient = this.clients.get(clientKey);

            // Return cached client if available and not stale
            if (cachedClient) {
                cachedClient.lastUsed = Date.now();
                return cachedClient.client as T;
            }

            // Create new client
            const serviceConstructor = this.getServiceConstructor(serviceName);
            const client = this.createClient(serviceConstructor, clientOptions);

            // Cache the client
            this.clients.set(clientKey, {
                client,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                config: this.getConfigHash(clientOptions),
            });

            return client as T;
        } catch (error) {
            throw new Error(
                `Failed to create gRPC client for service ${serviceName}: ${error.message}`,
            );
        }
    }

    /**
     * Creates a client with specific options for a service (used by decorators)
     */
    createClientForService<T>(serviceName: string, serviceOptions?: Partial<GrpcClientOptions>): T {
        return this.create<T>(serviceName, serviceOptions);
    }

    /**
     * Gets available services from the proto definition
     */
    getAvailableServices(): string[] {
        try {
            const protoServices = this.protoLoaderService.getProtoDefinition();
            if (!protoServices) {
                return [];
            }
            return this.getAvailableServicesRecursive(protoServices);
        } catch (error) {
            console.warn('Error getting available services:', error.message);
            return [];
        }
    }

    /**
     * Checks if a service exists in the proto definition
     */
    hasService(serviceName: string): boolean {
        try {
            this.getServiceConstructor(serviceName);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validates parameters for client creation
     */
    private validateCreateParameters(
        serviceName: string,
        options?: Partial<GrpcClientOptions>,
    ): void {
        if (!serviceName || typeof serviceName !== 'string') {
            throw new Error('Service name is required and must be a string');
        }

        if (options && typeof options !== 'object') {
            throw new Error('Options must be an object');
        }

        if (options?.url && typeof options.url !== 'string') {
            throw new Error('URL option must be a string');
        }
    }

    /**
     * Gets a cache key for the client with configuration hash
     */
    private getClientKey(serviceName: string, options: GrpcClientOptions): string {
        const configHash = this.getConfigHash(options);
        return `${serviceName}:${configHash}`;
    }

    /**
     * Generates a configuration hash for caching purposes
     */
    private getConfigHash(options: GrpcClientOptions): string {
        const configString = JSON.stringify({
            url: options.url,
            secure: options.secure,
            timeout: options.timeout,
            maxRetries: options.maxRetries,
            retryDelay: options.retryDelay,
        });

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < configString.length; i++) {
            const char = configString.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Gets the service constructor with improved error handling
     */
    private getServiceConstructor(serviceName: string): any {
        try {
            const protoServices = this.protoLoaderService.getProtoDefinition();

            if (!protoServices) {
                throw new Error('gRPC services not loaded yet. Ensure proto files are loaded.');
            }

            // Try direct service lookup
            let serviceConstructor = protoServices[serviceName];

            // Handle package-prefixed service names
            if (!serviceConstructor && serviceName.includes('.')) {
                serviceConstructor = this.findServiceByPath(protoServices, serviceName);
            }

            // Fallback: search for service name without package prefix
            if (!serviceConstructor) {
                const shortServiceName = serviceName.split('.').pop();
                if (shortServiceName) {
                    serviceConstructor = this.findServiceRecursively(
                        protoServices,
                        shortServiceName,
                    );
                }
            }

            if (!serviceConstructor) {
                const availableServices = this.getAvailableServicesRecursive(protoServices);
                throw new Error(
                    `Service '${serviceName}' not found. Available services: ${availableServices.join(', ')}`,
                );
            }

            if (typeof serviceConstructor !== 'function') {
                throw new Error(`Service '${serviceName}' is not a valid constructor function`);
            }

            return serviceConstructor;
        } catch (error) {
            throw new Error(`Service lookup failed: ${error.message}`);
        }
    }

    /**
     * Finds service by dot-separated path
     */
    private findServiceByPath(obj: any, path: string): any {
        try {
            const parts = path.split('.');
            let current = obj;

            for (const part of parts) {
                if (!current || typeof current !== 'object' || !current[part]) {
                    return null;
                }
                current = current[part];
            }

            return typeof current === 'function' ? current : null;
        } catch {
            return null;
        }
    }

    /**
     * Recursively searches for a service by name
     */
    private findServiceRecursively(obj: any, name: string): any {
        if (!obj || typeof obj !== 'object') {
            return null;
        }

        // Direct match
        if (obj[name] && typeof obj[name] === 'function') {
            return obj[name];
        }

        // Search nested objects
        for (const key in obj) {
            if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                const found = this.findServiceRecursively(obj[key], name);
                if (found) {
                    return found;
                }
            }
        }

        return null;
    }

    /**
     * Gets available services recursively with improved stability
     */
    private getAvailableServicesRecursive(obj: any, prefix = '', maxDepth = 5): string[] {
        if (!obj || typeof obj !== 'object' || maxDepth <= 0) {
            return [];
        }

        const services: string[] = [];

        try {
            for (const key in obj) {
                if (!obj.hasOwnProperty(key)) continue;

                const value = obj[key];
                const path = prefix ? `${prefix}.${key}` : key;

                if (typeof value === 'function') {
                    services.push(path);
                } else if (typeof value === 'object' && value !== null) {
                    const nestedServices = this.getAvailableServicesRecursive(
                        value,
                        path,
                        maxDepth - 1,
                    );
                    services.push(...nestedServices);
                }
            }
        } catch (error) {
            console.warn('Error while discovering services:', error.message);
        }

        return services;
    }

    /**
     * Merges client options with defaults and service-specific configuration
     */
    private mergeClientOptions(
        serviceName: string,
        options?: Partial<GrpcClientOptions>,
    ): GrpcClientOptions {
        const merged: GrpcClientOptions = {
            service: options?.service ?? serviceName,
            package: options?.package ?? this.options.package,
            protoPath: options?.protoPath ?? this.options.protoPath,
            url: options?.url ?? this.options.url ?? 'localhost:50051',
            maxRetries: Math.max(0, Math.min(10, options?.maxRetries ?? 3)),
            retryDelay: Math.max(100, Math.min(5000, options?.retryDelay ?? 1000)),
            secure: Boolean(options?.secure ?? this.options.secure),
            rootCerts: options?.rootCerts ?? this.options.rootCerts,
            privateKey: options?.privateKey ?? this.options.privateKey,
            certChain: options?.certChain ?? this.options.certChain,
            timeout: Math.max(1000, Math.min(300000, options?.timeout ?? 30000)),
            channelOptions: { ...this.options.loaderOptions, ...options?.channelOptions },
        };

        return merged;
    }

    /**
     * Creates a gRPC client with enhanced error handling
     */
    private createClient(serviceConstructor: any, options: GrpcClientOptions): any {
        try {
            const { url, secure, rootCerts, privateKey, certChain } = options;

            // Validate URL
            if (!url || typeof url !== 'string') {
                throw new Error('Invalid URL provided');
            }

            // Create credentials
            const credentials = createClientCredentials(secure, rootCerts, privateKey, certChain);

            // Create channel options
            const channelOptions = createChannelOptions(
                this.options.maxSendMessageSize,
                this.options.maxReceiveMessageSize,
                options.channelOptions,
            );

            // Create gRPC client
            const client = new serviceConstructor(url, credentials, channelOptions);

            if (!client) {
                throw new Error('Failed to create gRPC client');
            }

            // Wrap client with enhanced error handling
            return this.wrapClient(client, options);
        } catch (error) {
            throw new Error(`Client creation failed: ${error.message}`);
        }
    }

    /**
     * Wraps a gRPC client with promise/observable support and error handling
     */
    private wrapClient(client: any, options: GrpcClientOptions): any {
        try {
            const wrappedClient: Record<string, any> = {};
            const methods = getServiceMethods(client.constructor);

            if (methods.length === 0) {
                console.warn(`No methods found for gRPC service ${options.service}`);
            }

            for (const methodName of methods) {
                const originalMethod = client[methodName];

                if (!originalMethod || typeof originalMethod !== 'function') {
                    continue;
                }

                const isStreamingMethod = this.isStreamingMethod(client.constructor, methodName);

                if (isStreamingMethod) {
                    wrappedClient[methodName] = this.wrapStreamingMethod(
                        client,
                        methodName,
                        options,
                    );
                } else {
                    wrappedClient[methodName] = this.wrapUnaryMethod(client, methodName, options);
                }
            }

            // Add utility methods
            wrappedClient._getServiceName = () => options.service;
            wrappedClient._getOptions = () => ({ ...options });
            wrappedClient._close = () => {
                try {
                    if (client && typeof client.close === 'function') {
                        client.close();
                    }
                } catch (error) {
                    console.warn('Error closing client:', error.message);
                }
            };

            return wrappedClient;
        } catch (error) {
            throw new Error(`Client wrapping failed: ${error.message}`);
        }
    }

    /**
     * Checks if a method is streaming with better validation
     */
    private isStreamingMethod(serviceConstructor: any, methodName: string): boolean {
        try {
            if (!serviceConstructor?.service?.methods) {
                return false;
            }

            const methodDefinition = serviceConstructor.service.methods[methodName];
            return Boolean(
                methodDefinition &&
                    (methodDefinition.requestStream ?? methodDefinition.responseStream),
            );
        } catch {
            return false;
        }
    }

    /**
     * Wraps unary methods with enhanced error handling
     */
    private wrapUnaryMethod(
        client: any,
        methodName: string,
        options: GrpcClientOptions,
    ): (request: any, metadata?: grpc.Metadata) => Promise<any> {
        return (request: any, metadata?: grpc.Metadata): Promise<any> => {
            return new Promise<any>((resolve, reject) => {
                try {
                    if (!request) {
                        throw new Error('Request is required');
                    }

                    const meta = metadata ?? new grpc.Metadata();
                    const deadline = this.getDeadline(options.timeout);

                    const call = client[methodName](
                        request,
                        meta,
                        { deadline },
                        (error: Error | null, response: any) => {
                            if (error) {
                                reject(new Error(`gRPC call failed: ${error.message}`));
                            } else {
                                resolve(response);
                            }
                        },
                    );

                    // Handle call cancellation on timeout
                    const timeoutId = setTimeout(() => {
                        try {
                            call.cancel();
                            reject(new Error(`gRPC call timed out after ${options.timeout}ms`));
                        } catch {
                            reject(new Error(`gRPC call timeout and cancellation failed`));
                        }
                    }, options.timeout);

                    // Clear timeout on successful completion
                    call.on('end', () => clearTimeout(timeoutId));
                    call.on('error', () => clearTimeout(timeoutId));
                } catch (error) {
                    reject(new Error(`Failed to initiate gRPC call: ${error.message}`));
                }
            });
        };
    }

    /**
     * Wraps streaming methods with enhanced error handling and cleanup
     */
    private wrapStreamingMethod(
        client: any,
        methodName: string,
        options: GrpcClientOptions,
    ): (request: any, metadata?: grpc.Metadata) => Observable<any> {
        return (request: any, metadata?: grpc.Metadata): Observable<any> => {
            return new Observable(observer => {
                let call: any = null;
                let isCompleted = false;

                try {
                    if (!request) {
                        throw new Error('Request is required for streaming method');
                    }

                    const meta = metadata ?? new grpc.Metadata();
                    const deadline = this.getDeadline(options.timeout);

                    call = client[methodName](request, meta, { deadline });

                    // Track active stream
                    this.activeStreams.add(call);

                    call.on('data', (data: any) => {
                        try {
                            observer.next(data);
                        } catch (error) {
                            console.warn('Error processing stream data:', error.message);
                        }
                    });

                    call.on('end', () => {
                        if (!isCompleted) {
                            isCompleted = true;
                            observer.complete();
                        }
                    });

                    call.on('error', (error: Error) => {
                        if (!isCompleted) {
                            isCompleted = true;
                            observer.error(new Error(`gRPC stream error: ${error.message}`));
                        }
                    });

                    // Timeout handling
                    const timeoutId = setTimeout(() => {
                        if (!isCompleted && call) {
                            isCompleted = true;
                            try {
                                call.cancel();
                                observer.error(
                                    new Error(`gRPC stream timed out after ${options.timeout}ms`),
                                );
                            } catch {
                                observer.error(
                                    new Error('gRPC stream timeout and cancellation failed'),
                                );
                            }
                        }
                    }, options.timeout);

                    // Cleanup function
                    return () => {
                        isCompleted = true;
                        clearTimeout(timeoutId);

                        if (call) {
                            try {
                                this.activeStreams.delete(call);
                                call.cancel();
                            } catch (error) {
                                console.warn('Error during stream cleanup:', error.message);
                            }
                        }
                    };
                } catch (error) {
                    observer.error(new Error(`Failed to initiate gRPC stream: ${error.message}`));
                    return () => {}; // Empty cleanup function
                }
            });
        };
    }

    /**
     * Gets a deadline timestamp with validation
     */
    private getDeadline(timeout = 30000): number {
        const validTimeout = Math.max(1000, Math.min(300000, timeout));
        return Date.now() + validTimeout;
    }
}
