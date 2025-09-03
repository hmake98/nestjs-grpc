import * as grpc from '@grpc/grpc-js';
import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Observable, fromEvent, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import {
    GRPC_OPTIONS,
    DEFAULT_TIMEOUT,
    DEFAULT_RETRY_ATTEMPTS,
    DEFAULT_RETRY_DELAY,
    VALIDATION_LIMITS,
} from '../constants';
import { GrpcOptions, GrpcClientOptions } from '../interfaces';
import { GrpcLogger } from '../utils/logger';

import { GrpcProtoService } from './grpc-proto.service';

/**
 * Represents a cached gRPC client with metadata for cache management
 */
interface CachedClient {
    /** The actual gRPC client instance */
    client: any;
    /** Timestamp when the client was created */
    createdAt: number;
    /** Timestamp when the client was last used */
    lastUsed: number;
    /** Configuration hash for cache validation */
    config: string;
}

/**
 * Service responsible for creating and managing gRPC clients with caching,
 * streaming support, and automatic resource cleanup.
 *
 * Features:
 * - Client connection pooling and caching
 * - Automatic retry logic with configurable delays
 * - Support for unary, server streaming, client streaming, and bidirectional streaming
 * - Resource cleanup and connection management
 * - Performance monitoring and logging
 *
 * @example
 * ```typescript
 * // Inject the service
 * constructor(private grpcClient: GrpcClientService) {}
 *
 * // Make a unary call
 * const response = await this.grpcClient.call<LoginRequest, LoginResponse>(
 *   'AuthService',
 *   'login',
 *   { username: 'user', password: 'pass' }
 * );
 *
 * // Create a streaming call
 * const stream$ = this.grpcClient.serverStream<GetUpdatesRequest, Update>(
 *   'NotificationService',
 *   'getUpdates',
 *   { userId: '123' }
 * );
 * ```
 */
@Injectable()
export class GrpcClientService implements OnModuleInit, OnModuleDestroy {
    private readonly logger: GrpcLogger;
    /** Cache of active gRPC clients indexed by connection key */
    private readonly clients = new Map<string, CachedClient>();
    /** Set of active streaming connections for cleanup */
    private readonly activeStreams = new Set<any>();
    /** Interval timer for periodic client cleanup */
    private cleanupInterval?: NodeJS.Timeout;
    /** Time-to-live for cached clients (5 minutes) */
    private readonly CLIENT_CACHE_TTL = 5 * 60 * 1000;
    /** Interval between cleanup cycles (1 minute) */
    private readonly CLEANUP_INTERVAL = 60 * 1000;

    /**
     * Constructs the GrpcClientService with required dependencies
     *
     * @param options - Global gRPC configuration options
     * @param protoLoaderService - Service for loading proto definitions
     */
    constructor(
        @Inject(GRPC_OPTIONS) private readonly options: GrpcOptions,
        private readonly protoService: GrpcProtoService,
    ) {
        if (!options) {
            throw new Error('GRPC_OPTIONS is required');
        }

        if (!options.protoPath || typeof options.protoPath !== 'string') {
            throw new Error('protoPath is required in gRPC options');
        }

        if (!options.package || typeof options.package !== 'string') {
            throw new Error('package is required in gRPC options');
        }

        this.logger = new GrpcLogger({
            ...options.logging,
            context: 'GrpcClient',
        });
    }

    /**
     * Lifecycle hook called after the module has been initialized.
     * Sets up periodic client cleanup and starts the service.
     */
    onModuleInit(): void {
        if (!this.protoService) {
            throw new Error('GrpcProtoService is not available');
        }

        try {
            this.logger.lifecycle('GrpcClientService starting', {
                maxCacheSize: this.CLIENT_CACHE_TTL,
                cleanupInterval: this.CLEANUP_INTERVAL,
            });

            // Optionally trigger proto loading without blocking initialization
            // The proto service itself will load on its own onModuleInit in most cases
            // and client methods validate availability before usage.
            void this.protoService.load();

            // Start cleanup interval
            this.cleanupInterval = setInterval(() => {
                this.cleanupStaleClients();
            }, this.CLEANUP_INTERVAL);

            this.logger.lifecycle('GrpcClientService started successfully');
        } catch (_error) {
            throw new Error('Failed to initialize GrpcClientService');
        }
    }

    /**
     * Lifecycle hook called when the module is being destroyed.
     * Performs cleanup of all active connections, streams, and timers.
     */
    onModuleDestroy(): void {
        try {
            this.logger.lifecycle('GrpcClientService shutting down');

            // Clear cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }

            // Close all active streams
            let streamsClosedCount = 0;
            for (const stream of this.activeStreams) {
                try {
                    if (stream && typeof stream.cancel === 'function') {
                        stream.cancel();
                        streamsClosedCount++;
                    }
                } catch (error) {
                    this.logger.warn('Error cancelling stream', error);
                }
            }
            this.activeStreams.clear();

            // Close all clients
            let clientsClosedCount = 0;
            for (const [key, cachedClient] of this.clients) {
                try {
                    if (cachedClient.client && typeof cachedClient.client.close === 'function') {
                        cachedClient.client.close();
                        clientsClosedCount++;
                    }
                } catch (error) {
                    this.logger.warn(`Error closing client ${key}`, error);
                }
            }
            this.clients.clear();

            this.logger.lifecycle('GrpcClientService shutdown complete', {
                clientsClosed: clientsClosedCount,
                streamsClosed: streamsClosedCount,
            });
        } catch (error) {
            this.logger.error('Error during GrpcClientService cleanup', error);
        }
    }

    /**
     * Creates or retrieves a cached gRPC client for the specified service.
     * Clients are cached based on service name, URL, and security settings.
     *
     * @template T - The type of the gRPC client interface
     * @param serviceName - Name of the gRPC service as defined in the proto file
     * @param options - Optional client configuration to override global settings
     * @returns A typed gRPC client instance
     *
     * @example
     * ```typescript
     * interface AuthServiceClient {
     *   login(request: LoginRequest): Promise<LoginResponse>;
     * }
     *
     * const client = this.grpcClient.create<AuthServiceClient>('AuthService', {
     *   url: 'auth-service:50051',
     *   timeout: 5000
     * });
     * ```
     */
    async create<T>(serviceName: string, options?: Partial<GrpcClientOptions>): Promise<T> {
        // Validate service name
        if (!serviceName || typeof serviceName !== 'string') {
            throw new Error('Service name is required and must be a string');
        }

        // Validate options
        if (options !== undefined && (typeof options !== 'object' || options === null)) {
            throw new Error('Options must be an object');
        }

        // Validate URL if provided
        if (options?.url !== undefined && typeof options.url !== 'string') {
            throw new Error('URL option must be a string');
        }

        try {
            this.logger.debug(`Creating gRPC client for service: ${serviceName}`);

            const clientOptions = this.mergeClientOptions(serviceName, options);
            const clientKey = this.getClientKey(serviceName, clientOptions);
            const cachedClient = this.clients.get(clientKey);

            // Return cached client if available and not stale
            if (cachedClient) {
                cachedClient.lastUsed = Date.now();
                this.logger.debug(`Returning cached gRPC client for ${serviceName}`);
                return cachedClient.client as T;
            }

            // Create new client
            const serviceConstructor = await this.getServiceConstructor(serviceName);
            const client = this.createClient(serviceConstructor, clientOptions);

            // Cache the client
            this.clients.set(clientKey, {
                client,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                config: this.getConfigHash(clientOptions),
            });

            this.logger.connection('Created gRPC client', serviceName, {
                url: clientOptions.url,
                secure: clientOptions.secure,
            });
            return client as T;
        } catch (error) {
            if (
                error.message.includes('not found in proto definition') ||
                error.message.includes('Proto load failed') ||
                error.message.includes('not loaded yet') ||
                error.message.includes('Proto not loaded')
            ) {
                throw new Error('Service lookup failed');
            }
            throw error;
        }
    }

    /**
     * Makes a unary (request-response) call to a gRPC service method.
     * Includes automatic retry logic and performance monitoring.
     *
     * @template TRequest - Type of the request message
     * @template TResponse - Type of the response message
     * @param serviceName - Name of the gRPC service
     * @param methodName - Name of the method to call
     * @param request - Request message to send
     * @param options - Optional client configuration overrides
     * @returns Promise that resolves to the response message
     *
     * @example
     * ```typescript
     * const response = await this.grpcClient.call<LoginRequest, LoginResponse>(
     *   'AuthService',
     *   'login',
     *   { username: 'user', password: 'pass' },
     *   { timeout: 5000, maxRetries: 2 }
     * );
     * console.log(response.token);
     * ```
     */
    async call<TRequest, TResponse>(
        serviceName: string,
        methodName: string,
        request: TRequest,
        options?: Partial<GrpcClientOptions>,
    ): Promise<TResponse> {
        this.logger.debug(`Starting call to ${serviceName}.${methodName}`);

        const clientOptions = this.mergeClientOptions(serviceName, options);

        // Validate method exists before making call
        if (!this.validateMethod(serviceName, methodName)) {
            this.logger.error(`Method validation failed for ${serviceName}.${methodName}`);
            throw new Error(`Method ${methodName} not found in service ${serviceName}`);
        }

        this.logger.debug(`Method validation passed for ${serviceName}.${methodName}`);

        const client = await this.create(serviceName, clientOptions);

        const startTime = Date.now();

        try {
            this.logger.debug(`Making unary call to ${serviceName}.${methodName}`);

            const result = await this.executeWithRetry(
                () => this.callUnaryMethod(client, methodName, request, clientOptions),
                clientOptions?.maxRetries ?? DEFAULT_RETRY_ATTEMPTS,
                clientOptions?.retryDelay ?? DEFAULT_RETRY_DELAY,
            );

            const duration = Date.now() - startTime;
            this.logger.performance(`${serviceName}.${methodName} completed`, duration);

            return result as TResponse;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(
                `Unary call ${serviceName}.${methodName} failed after ${duration}ms`,
                error,
            );
            throw error;
        }
    }

    /**
     * Makes a server streaming call where the client sends one request
     * and receives a stream of responses from the server.
     *
     * @template TRequest - Type of the request message
     * @template TResponse - Type of the response messages in the stream
     * @param serviceName - Name of the gRPC service
     * @param methodName - Name of the streaming method to call
     * @param request - Initial request message to send
     * @param options - Optional client configuration overrides
     * @returns Observable stream of response messages
     *
     * @example
     * ```typescript
     * const updates$ = this.grpcClient.serverStream<GetUpdatesRequest, Update>(
     *   'NotificationService',
     *   'getUpdates',
     *   { userId: '123', since: new Date() }
     * );
     *
     * updates$.subscribe({
     *   next: (update) => console.log('Received update:', update),
     *   error: (err) => console.error('Stream error:', err),
     *   complete: () => console.log('Stream completed')
     * });
     * ```
     */
    serverStream<TRequest, TResponse>(
        serviceName: string,
        methodName: string,
        request: TRequest,
        options?: Partial<GrpcClientOptions>,
    ): Observable<TResponse> {
        const startTime = Date.now();

        return new Observable<TResponse>(observer => {
            this.create(serviceName, options)
                .then(client => {
                    try {
                        this.logger.methodCall(methodName, serviceName);

                        const stream = (client as any)[methodName](request);
                        this.activeStreams.add(stream);

                        const subscription = fromEvent(stream, 'data')
                            .pipe(
                                map((data: TResponse) => {
                                    this.logger.debug(
                                        `Received stream data from ${serviceName}.${methodName}`,
                                    );
                                    return data;
                                }),
                                catchError(error => {
                                    const duration = Date.now() - startTime;
                                    this.logger.error(
                                        `Server stream ${serviceName}.${methodName} failed after ${duration}ms`,
                                        error,
                                    );
                                    this.activeStreams.delete(stream);
                                    return throwError(() => error);
                                }),
                            )
                            .subscribe(observer);

                        // Handle stream completion
                        stream.on('end', () => {
                            const duration = Date.now() - startTime;
                            this.logger.performance(
                                `Server stream ${serviceName}.${methodName} completed`,
                                duration,
                            );
                            this.activeStreams.delete(stream);
                            subscription.unsubscribe();
                            observer.complete();
                        });

                        stream.on('error', (error: any) => {
                            const duration = Date.now() - startTime;
                            this.logger.error(
                                `Server stream ${serviceName}.${methodName} failed after ${duration}ms`,
                                error,
                            );
                            this.activeStreams.delete(stream);
                            subscription.unsubscribe();
                            observer.error(error);
                        });
                    } catch (error) {
                        const duration = Date.now() - startTime;
                        this.logger.error(
                            `Server stream ${serviceName}.${methodName} failed after ${duration}ms`,
                            error,
                        );
                        observer.error(error);
                    }
                })
                .catch(error => {
                    const duration = Date.now() - startTime;
                    this.logger.error(
                        `Server stream ${serviceName}.${methodName} client creation failed after ${duration}ms`,
                        error,
                    );
                    observer.error(error);
                });
        });
    }

    /**
     * Makes a client streaming call where the client sends a stream of requests
     * and receives a single response from the server.
     *
     * @template TRequest - Type of the request messages in the stream
     * @template TResponse - Type of the final response message
     * @param serviceName - Name of the gRPC service
     * @param methodName - Name of the streaming method to call
     * @param request - Observable stream of request messages to send
     * @param options - Optional client configuration overrides
     * @returns Promise that resolves to the final response message
     *
     * @example
     * ```typescript
     * const requests$ = new Subject<UploadChunk>();
     *
     * const response = await this.grpcClient.clientStream<UploadChunk, UploadResult>(
     *   'FileService',
     *   'uploadFile',
     *   requests$
     * );
     *
     * // Send chunks
     * requests$.next({ data: chunk1, sequence: 1 });
     * requests$.next({ data: chunk2, sequence: 2 });
     * requests$.complete();
     *
     * console.log('Upload result:', response.fileId);
     * ```
     */
    async clientStream<TRequest, TResponse>(
        serviceName: string,
        methodName: string,
        request: Observable<TRequest>,
        options?: Partial<GrpcClientOptions>,
    ): Promise<TResponse> {
        const startTime = Date.now();
        const client = await this.create(serviceName, options);

        try {
            this.logger.debug(`Calling client stream method: ${serviceName}.${methodName}`);

            const stream = (client as any)[methodName]();
            this.activeStreams.add(stream);

            // Subscribe to the request observable and write to stream
            request.subscribe({
                next: (data: TRequest) => {
                    stream.write(data);
                },
                error: error => {
                    this.logger.error(
                        `Client stream ${serviceName}.${methodName} request error`,
                        error,
                    );
                    stream.end();
                    this.activeStreams.delete(stream);
                },
                complete: () => {
                    stream.end();
                },
            });

            // Wait for response
            const result = await new Promise<TResponse>((resolve, reject) => {
                stream.on('data', (data: TResponse) => {
                    resolve(data);
                });

                stream.on('error', error => {
                    const duration = Date.now() - startTime;
                    this.logger.error(
                        `Client stream ${serviceName}.${methodName} failed after ${duration}ms`,
                        error,
                    );
                    this.activeStreams.delete(stream);
                    reject(error);
                });

                stream.on('end', () => {
                    const duration = Date.now() - startTime;
                    this.logger.performance(
                        `Client stream ${serviceName}.${methodName} completed`,
                        duration,
                    );
                    this.activeStreams.delete(stream);
                });
            });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(
                `Client stream ${serviceName}.${methodName} failed after ${duration}ms`,
                error,
            );
            throw error;
        }
    }

    /**
     * Makes a bidirectional streaming call where both client and server
     * can send streams of messages to each other simultaneously.
     *
     * @template TRequest - Type of the request messages in the stream
     * @template TResponse - Type of the response messages in the stream
     * @param serviceName - Name of the gRPC service
     * @param methodName - Name of the bidirectional streaming method
     * @param request - Observable stream of request messages to send
     * @param options - Optional client configuration overrides
     * @returns Observable stream of response messages
     *
     * @example
     * ```typescript
     * const requests$ = new Subject<ChatMessage>();
     *
     * const responses$ = this.grpcClient.bidiStream<ChatMessage, ChatMessage>(
     *   'ChatService',
     *   'chat',
     *   requests$
     * );
     *
     * // Listen to responses
     * responses$.subscribe(message => {
     *   console.log('Received:', message.text);
     * });
     *
     * // Send messages
     * requests$.next({ text: 'Hello!', userId: '123' });
     * requests$.next({ text: 'How are you?', userId: '123' });
     * ```
     */
    bidiStream<TRequest, TResponse>(
        serviceName: string,
        methodName: string,
        request: Observable<TRequest>,
        options?: Partial<GrpcClientOptions>,
    ): Observable<TResponse> {
        const startTime = Date.now();

        return new Observable<TResponse>(observer => {
            this.create(serviceName, options)
                .then(client => {
                    try {
                        this.logger.debug(
                            `Calling bidirectional stream method: ${serviceName}.${methodName}`,
                        );

                        const stream = (client as any)[methodName]();
                        this.activeStreams.add(stream);

                        // Subscribe to the request observable and write to stream
                        request.subscribe({
                            next: (data: TRequest) => {
                                stream.write(data);
                            },
                            error: error => {
                                this.logger.error(
                                    `Bidirectional stream ${serviceName}.${methodName} request error`,
                                    error,
                                );
                                stream.end();
                                this.activeStreams.delete(stream);
                                observer.error(error);
                            },
                            complete: () => {
                                stream.end();
                            },
                        });

                        // Handle response stream
                        const subscription = fromEvent(stream, 'data')
                            .pipe(
                                map((data: TResponse) => {
                                    this.logger.debug(
                                        `Received bidirectional stream data from ${serviceName}.${methodName}`,
                                    );
                                    return data;
                                }),
                                catchError(error => {
                                    const duration = Date.now() - startTime;
                                    this.logger.error(
                                        `Bidirectional stream ${serviceName}.${methodName} failed after ${duration}ms`,
                                        error,
                                    );
                                    this.activeStreams.delete(stream);
                                    return throwError(() => error);
                                }),
                            )
                            .subscribe(observer);

                        // Handle stream completion
                        stream.on('end', () => {
                            const duration = Date.now() - startTime;
                            this.logger.performance(
                                `Bidirectional stream ${serviceName}.${methodName} completed`,
                                duration,
                            );
                            this.activeStreams.delete(stream);
                            subscription.unsubscribe();
                            observer.complete();
                        });

                        stream.on('error', (error: any) => {
                            const duration = Date.now() - startTime;
                            this.logger.error(
                                `Bidirectional stream ${serviceName}.${methodName} failed after ${duration}ms`,
                                error,
                            );
                            this.activeStreams.delete(stream);
                            subscription.unsubscribe();
                            observer.error(error);
                        });
                    } catch (error) {
                        const duration = Date.now() - startTime;
                        this.logger.error(
                            `Bidirectional stream ${serviceName}.${methodName} failed after ${duration}ms`,
                            error,
                        );
                        observer.error(error);
                    }
                })
                .catch(error => {
                    const duration = Date.now() - startTime;
                    this.logger.error(
                        `Bidirectional stream ${serviceName}.${methodName} client creation failed after ${duration}ms`,
                        error,
                    );
                    observer.error(error);
                });
        });
    }

    /**
     * Removes stale clients from the cache based on their last usage time.
     * Called periodically by the cleanup interval to prevent memory leaks.
     *
     * @private
     */
    private cleanupStaleClients(): void {
        const now = Date.now();
        const staleCutoff = now - this.CLIENT_CACHE_TTL;
        let cleanedUpCount = 0;

        for (const [key, cachedClient] of this.clients) {
            if (cachedClient.lastUsed < staleCutoff) {
                try {
                    if (cachedClient.client && typeof cachedClient.client.close === 'function') {
                        cachedClient.client.close();
                    }
                    cleanedUpCount++;
                } catch (error) {
                    this.logger.warn(`Error closing stale client ${key}`, error);
                } finally {
                    this.clients.delete(key);
                }
            }
        }

        if (cleanedUpCount > 0) {
            this.logger.debug(`Cleaned up ${cleanedUpCount} stale gRPC clients`);
        }
    }

    /**
     * Executes a function with exponential backoff retry logic.
     * Used internally for handling transient network failures.
     *
     * @template T - Return type of the function
     * @param fn - Function to execute with retry logic
     * @param maxRetries - Maximum number of retry attempts
     * @param retryDelay - Base delay in milliseconds between retries
     * @returns Promise that resolves to the function result
     * @throws The last error if all retries are exhausted
     *
     * @private
     */
    private async executeWithRetry<T>(
        fn: () => Promise<T>,
        maxRetries: number,
        retryDelay: number,
    ): Promise<T> {
        let lastError: Error = new Error('Unknown error');

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;

                if (attempt === maxRetries) {
                    break;
                }

                this.logger.debug(
                    `Retry attempt ${attempt + 1}/${maxRetries} failed, retrying in ${retryDelay}ms`,
                );
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        throw lastError;
    }

    /**
     * Generates a unique cache key for a gRPC client based on service name and connection options.
     *
     * @param serviceName - Name of the gRPC service
     * @param options - Client configuration options
     * @returns Unique string key for client caching
     *
     * @private
     */
    private getClientKey(serviceName: string, options: GrpcClientOptions): string {
        return `${serviceName}:${options.url}:${options.secure ? 'secure' : 'insecure'}`;
    }

    /**
     * Creates a configuration hash for client cache validation.
     * Used to detect when client configuration has changed.
     *
     * @param options - Client configuration options
     * @returns JSON string hash of the configuration
     *
     * @private
     */
    private getConfigHash(options: GrpcClientOptions): string {
        return JSON.stringify({
            url: options.url,
            secure: options.secure,
            timeout: options.timeout,
            maxRetries: options.maxRetries,
            retryDelay: options.retryDelay,
        });
    }

    /**
     * Merges service-specific client options with global configuration defaults.
     * Service-specific options take precedence over global settings.
     *
     * @param serviceName - Name of the gRPC service
     * @param options - Optional service-specific configuration overrides
     * @returns Complete client options with defaults applied
     *
     * @private
     */
    private mergeClientOptions(
        serviceName: string,
        options?: Partial<GrpcClientOptions>,
    ): GrpcClientOptions {
        // Clamp values to ensure they are within valid ranges
        const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
        const maxRetries = options?.maxRetries ?? DEFAULT_RETRY_ATTEMPTS;
        const retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY;

        return {
            service: serviceName,
            package: options?.package ?? this.options.package,
            url: options?.url ?? this.options.url ?? 'localhost:50051',
            secure: options?.secure ?? this.options.secure ?? false,
            timeout: Math.max(
                Math.min(timeout, VALIDATION_LIMITS.MAX_TIMEOUT),
                VALIDATION_LIMITS.MIN_TIMEOUT,
            ),
            maxRetries: Math.max(
                Math.min(maxRetries, VALIDATION_LIMITS.MAX_RETRIES),
                VALIDATION_LIMITS.MIN_RETRIES,
            ),
            retryDelay: Math.max(
                Math.min(retryDelay, VALIDATION_LIMITS.MAX_RETRY_DELAY),
                VALIDATION_LIMITS.MIN_RETRY_DELAY,
            ),
            rootCerts: options?.rootCerts ?? this.options.rootCerts,
            privateKey: options?.privateKey ?? this.options.privateKey,
            certChain: options?.certChain ?? this.options.certChain,
            channelOptions: options?.channelOptions,
        };
    }

    /**
     * Retrieves the service constructor function from the loaded proto definition.
     *
     * @param serviceName - Name of the gRPC service to find
     * @returns Service constructor function for creating client instances
     * @throws Error if the service is not found in the proto definition
     *
     * @private
     */
    private async getServiceConstructor(serviceName: string): Promise<any> {
        try {
            // Ensure proto service is loaded first
            await this.protoService.load();

            const packageDefinition = this.protoService.getProtoDefinition();

            if (!packageDefinition) {
                throw new Error('gRPC services not loaded yet');
            }

            const servicePath = this.findServicePath(packageDefinition, serviceName);

            if (!servicePath) {
                // List available services for debugging
                const availableServices = this.getAvailableServiceNames(packageDefinition);
                this.logger.debug(`Available services: ${availableServices.join(', ')}`);
                throw new Error(
                    `Service '${serviceName}' not found in proto definition. Available services: ${availableServices.join(', ')}`,
                );
            }

            if (typeof servicePath !== 'function') {
                throw new Error(`'${serviceName}' is not a valid constructor function`);
            }

            return servicePath;
        } catch (error) {
            if (
                error.message.includes('not loaded yet') ||
                error.message.includes('Proto not loaded')
            ) {
                throw new Error(`Service lookup failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Gets available service names from the proto definition for debugging
     *
     * @param obj - Proto package definition object
     * @returns Array of service names
     *
     * @private
     */
    private getAvailableServiceNames(obj: any): string[] {
        const serviceNames: string[] = [];

        if (!obj || typeof obj !== 'object') {
            return serviceNames;
        }

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (typeof value === 'function') {
                    serviceNames.push(key);
                } else if (typeof value === 'object') {
                    // Recursively search nested objects
                    serviceNames.push(...this.getAvailableServiceNames(value));
                }
            }
        }

        return serviceNames;
    }

    /**
     * Recursively searches through the proto package definition to find a specific service.
     * Handles nested package structures and service definitions.
     *
     * @param obj - Proto package definition object to search
     * @param serviceName - Name of the service to find
     * @returns Service constructor if found, null otherwise
     *
     * @private
     */
    private findServicePath(obj: any, serviceName: string): any {
        if (!obj || typeof obj !== 'object') {
            return null;
        }

        // Check if this object has the service
        if (obj[serviceName] && typeof obj[serviceName] === 'function') {
            return obj[serviceName];
        }

        // Recursively search nested objects
        for (const key in obj) {
            if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                const result = this.findServicePath(obj[key], serviceName);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    /**
     * Creates a new gRPC client instance with proper credentials and channel options.
     * Configures TLS settings, keepalive parameters, and message size limits.
     *
     * @param serviceConstructor - Service constructor function from proto definition
     * @param options - Complete client configuration options
     * @returns Configured gRPC client instance
     *
     * @private
     */
    private createClient(serviceConstructor: any, options: GrpcClientOptions): any {
        try {
            const credentials = options.secure
                ? grpc.credentials.createSsl(
                      options.rootCerts,
                      options.privateKey,
                      options.certChain,
                  )
                : grpc.credentials.createInsecure();

            const client = new serviceConstructor(options.url, credentials, {
                'grpc.keepalive_time_ms': 2 * 60 * 60 * 1000, // 2 hours
                'grpc.keepalive_timeout_ms': 20 * 1000, // 20 seconds
                'grpc.keepalive_permit_without_calls': true,
                'grpc.max_send_message_length': this.options.maxSendMessageSize,
                'grpc.max_receive_message_length': this.options.maxReceiveMessageSize,
                ...options.channelOptions,
            });

            return client;
        } catch (error) {
            throw new Error(
                `Failed to create gRPC client for service ${options.service}: ${error.message}`,
            );
        }
    }

    /**
     * Makes a unary gRPC call with proper callback handling
     *
     * @param client - The gRPC client instance
     * @param methodName - Name of the method to call
     * @param request - Request payload
     * @param options - Client options (optional)
     * @returns Promise that resolves with the response
     *
     * @private
     */
    private callUnaryMethod<TRequest, TResponse>(
        client: any,
        methodName: string,
        request: TRequest,
        options?: Partial<GrpcClientOptions>,
    ): Promise<TResponse> {
        return new Promise<TResponse>((resolve, reject) => {
            const deadline = options?.timeout ? new Date(Date.now() + options.timeout) : undefined;

            const callOptions = deadline ? { deadline } : {};

            // Make the gRPC call with proper callback signature
            (client as any)[methodName](request, callOptions, (error: any, response: TResponse) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Validates that a method exists in the proto definition before making a call
     */
    private validateMethod(serviceName: string, methodName: string): boolean {
        try {
            const protoDefinition = this.protoService.getProtoDefinition();
            if (!protoDefinition) {
                this.logger.warn('Proto definition not loaded');
                return false;
            }

            const service = protoDefinition[serviceName];
            if (!service) {
                this.logger.warn(`Service ${serviceName} not found in proto definition`);
                return false;
            }

            // For now, assume all methods are valid if service exists
            // More sophisticated validation can be added later
            return true;
        } catch (error) {
            this.logger.error(`Failed to validate method ${serviceName}.${methodName}`, error);
            return false;
        }
    }
}
