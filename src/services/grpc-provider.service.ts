import * as grpc from '@grpc/grpc-js';
import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

import { GRPC_OPTIONS, PROTO_SERVICE_LOAD_TIMEOUT } from '../constants';
import { GrpcOptions, ControllerMetadata } from '../interfaces';
import { GrpcLogger } from '../utils/logger';

import { GrpcProtoService } from './grpc-proto.service';

/**
 * Service responsible for managing gRPC provider functionality.
 * Handles server lifecycle, method routing, and controller registration.
 *
 * Features:
 * - Automatic server creation and startup
 * - Method routing to controller handlers
 * - Secure and insecure connection support
 * - Graceful shutdown and cleanup
 * - Performance monitoring and logging
 * - Controller instance management
 *
 * @example
 * ```typescript
 * // Provider is automatically started when module initializes
 * // Controllers are discovered and methods are registered
 * // Consumers can connect and call RPC methods
 * ```
 */
@Injectable()
export class GrpcProviderService implements OnModuleInit, OnModuleDestroy {
    private readonly logger: GrpcLogger;
    private server: grpc.Server | null = null;
    private isRunning = false;
    private readonly controllerInstances = new Map<string, any>();
    private readonly registeredServices = new Set<string>();
    private readonly pendingControllers = new Map<string, ControllerMetadata>();

    constructor(
        @Inject(GRPC_OPTIONS) private readonly options: GrpcOptions,
        private readonly protoService: GrpcProtoService,
    ) {
        this.logger = new GrpcLogger({
            ...options.logging,
            context: 'GrpcProvider',
        });
    }

    /**
     * Lifecycle hook called when the module is initialized.
     * Creates and starts the gRPC server with registered controllers.
     */
    async onModuleInit(): Promise<void> {
        try {
            this.logger.log('Starting gRPC provider');

            this.createServer();
            await this.startServer();

            this.logger.log('gRPC provider started successfully');
        } catch (error) {
            this.logger.error('Failed to start gRPC provider', error as Error);
            throw error;
        }
    }

    /**
     * Lifecycle hook called when the module is being destroyed.
     * Gracefully shuts down the gRPC server.
     */
    async onModuleDestroy(): Promise<void> {
        try {
            this.logger.log('Shutting down gRPC provider');
            await this.stopServer();
            this.logger.log('gRPC provider shutdown complete');
        } catch (error) {
            this.logger.error('Error during gRPC provider shutdown', error as Error);
        }
    }

    /**
     * Gets the current server instance
     */
    getServer(): grpc.Server | null {
        return this.server;
    }

    /**
     * Checks if the server is currently running
     */
    isServerRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Gets registered controller instances
     */
    getControllerInstances(): ReadonlyMap<string, any> {
        return this.controllerInstances;
    }

    /**
     * Registers a controller instance for method routing
     */
    registerController(serviceName: string, instance: any, metadata: ControllerMetadata): void {
        try {
            // Store controller instance
            this.controllerInstances.set(serviceName, instance);
            this.logger.debug(`Registered controller instance for service: ${serviceName}`);

            // Store metadata for later registration
            this.pendingControllers.set(serviceName, metadata);

            // If server is already running and service not yet registered, register it
            if (this.server && this.isRunning && !this.registeredServices.has(serviceName)) {
                this.addServiceToServer(serviceName, metadata);
                this.registeredServices.add(serviceName);
            } else if (!this.server || !this.isRunning) {
                this.logger.debug(
                    `Server not ready, will register service ${serviceName} when server starts`,
                );
            } else if (this.registeredServices.has(serviceName)) {
                this.logger.debug(`Service ${serviceName} already registered`);
            }
        } catch (error) {
            this.logger.error(`Failed to register controller ${serviceName}`, error as Error);
            throw error;
        }
    }

    /**
     * Creates the gRPC server instance
     */
    private createServer(): void {
        this.server = new grpc.Server({
            'grpc.max_send_message_length': this.options.maxSendMessageSize,
            'grpc.max_receive_message_length': this.options.maxReceiveMessageSize,
        });

        this.logger.debug('gRPC server instance created');
    }

    /**
     * Registers any pending controllers with the server
     */
    private async registerPendingControllers(): Promise<void> {
        if (this.pendingControllers.size === 0) {
            this.logger.debug('No pending controllers to register');
            return;
        }

        // Wait for proto service to be ready with timeout
        this.logger.debug('Ensuring proto service is loaded before registering controllers');
        try {
            const loadPromise = this.protoService.load();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error('Proto service load timeout')),
                    PROTO_SERVICE_LOAD_TIMEOUT,
                ),
            );

            await Promise.race([loadPromise, timeoutPromise]);
            this.logger.debug('Proto service is ready');
        } catch (error) {
            this.logger.error('Failed to load proto service', error as Error);
            return;
        }

        this.logger.debug(`Registering ${this.pendingControllers.size} pending controllers`);

        const registrationErrors: string[] = [];

        for (const [serviceName, metadata] of Array.from(this.pendingControllers.entries())) {
            if (!this.registeredServices.has(serviceName)) {
                try {
                    this.addServiceToServer(serviceName, metadata);
                    this.registeredServices.add(serviceName);
                    this.logger.debug(`Successfully registered pending controller: ${serviceName}`);
                } catch (error) {
                    const errorMsg = `Failed to register pending controller ${serviceName}: ${error.message}`;
                    registrationErrors.push(errorMsg);
                    this.logger.error(errorMsg, error as Error);
                }
            }
        }

        if (registrationErrors.length > 0) {
            this.logger.warn(
                `Some controllers failed to register: ${registrationErrors.join(', ')}`,
            );
        }
    }

    /**
     * Adds a service to the gRPC server
     */
    private addServiceToServer(serviceName: string, metadata: ControllerMetadata): void {
        if (!this.server) {
            throw new Error('Server not initialized');
        }

        const protoDefinition = this.protoService.getProtoDefinition();

        // Find the service definition in proto
        this.logger.debug(`Looking for service definition: ${serviceName}`);
        const serviceDefinition = this.findServiceDefinition(protoDefinition, serviceName);

        if (!serviceDefinition) {
            this.logger.error(
                `Service definition not found for ${serviceName} in proto definition`,
            );
            this.logger.debug(
                `Available services in proto: ${Object.keys(protoDefinition).join(', ')}`,
            );
            throw new Error(`Service definition not found for ${serviceName}`);
        }

        this.logger.debug(`Service definition found for ${serviceName}`);

        // Validate methods and register service
        this.logger.debug(`Validating methods for ${serviceName}`);
        this.validateMethods(serviceName, metadata, serviceDefinition);
    }

    /**
     * Creates a method handler that routes calls to controller instances
     */
    private createMethodHandler(serviceName: string, controllerMethodName: string) {
        return async (call: any, callback: any) => {
            const startTime = Date.now();

            try {
                this.logger.debug(`Method call: ${serviceName}.${controllerMethodName}`);

                // Get controller instance
                const controllerInstance = this.controllerInstances.get(serviceName);

                if (!controllerInstance) {
                    throw new Error(`Controller instance not found for service ${serviceName}`);
                }

                // Get the method from controller using the provided method name
                const method = controllerInstance[controllerMethodName];

                if (!method || typeof method !== 'function') {
                    const availableMethods = Object.getOwnPropertyNames(
                        Object.getPrototypeOf(controllerInstance),
                    );
                    this.logger.error(
                        `Method not found. Available methods: ${availableMethods.join(', ')}`,
                    );
                    throw new Error(
                        `Method ${controllerMethodName} not found in controller ${serviceName}`,
                    );
                }

                // Call the controller method
                const request = call.request;
                const result = await method.call(controllerInstance, request);

                const duration = Date.now() - startTime;
                this.logger.verbose(
                    `${serviceName}.${controllerMethodName} completed (${duration}ms)`,
                );

                // Send response
                callback(null, result);
            } catch (error) {
                const duration = Date.now() - startTime;
                this.logger.error(
                    `Method ${serviceName}.${controllerMethodName} failed after ${duration}ms`,
                    error as Error,
                );

                // Convert error to gRPC error
                const grpcError = this.convertToGrpcError(error);
                callback(grpcError);
            }
        };
    }

    /**
     * Finds service definition in proto package
     */
    private findServiceDefinition(protoDefinition: any, serviceName: string): any {
        this.logger.debug(`Finding service definition for: ${serviceName}`);

        if (!protoDefinition || typeof protoDefinition !== 'object') {
            this.logger.debug('Proto definition is null or not an object');
            return null;
        }

        this.logger.debug(`Looking for service ${serviceName} in proto definition`);
        this.logger.debug(`Available keys: ${Object.keys(protoDefinition).join(', ')}`);

        // Try to find the service directly
        if (protoDefinition[serviceName]) {
            const service = protoDefinition[serviceName];
            this.logger.debug(`Found service ${serviceName} directly in proto definition`);

            if (typeof service === 'function') {
                this.logger.debug(`Service ${serviceName} is a function (constructor)`);
                return service;
            }

            if (service && typeof service === 'object' && service.service) {
                this.logger.debug(`Service ${serviceName} has service property`);
                return service;
            }

            this.logger.debug(`Service ${serviceName} found but is not a valid service definition`);
            return null;
        }

        this.logger.debug(`Service ${serviceName} not found directly in proto definition`);

        // Search in nested packages
        for (const key in protoDefinition) {
            const value = protoDefinition[key];
            if (value && typeof value === 'object' && value[serviceName]) {
                this.logger.debug(`Searching in nested package: ${key}`);
                const nestedService = value[serviceName];
                this.logger.debug(`Found service ${serviceName} in nested package ${key}`);
                return nestedService;
            }
        }

        this.logger.warn(`Service ${serviceName} not found in proto definition`);
        return null;
    }

    /**
     * Starts the gRPC server
     */
    private async startServer(): Promise<void> {
        if (!this.server) {
            throw new Error('Server not created');
        }

        const url = this.options.url ?? 'localhost:50051';
        const credentials = this.createServerCredentials();

        return new Promise<void>((resolve, reject) => {
            if (!this.server) {
                reject(new Error('Server not initialized')); /* istanbul ignore next */
                return;
            }
            this.server.bindAsync(url, credentials, (error, _port) => {
                if (error) {
                    reject(new Error(`Failed to bind server to ${url}: ${error.message}`));
                    return;
                }

                this.isRunning = true;

                // Register any pending controller instances that were registered before server was running
                this.registerPendingControllers()
                    .then(() => {
                        this.logger.log('gRPC server started');
                        resolve();
                    })
                    .catch(registerError => {
                        this.logger.error(
                            'Failed to register pending controllers',
                            registerError as Error,
                        );
                        reject(registerError);
                    });
            });
        });
    }

    /**
     * Creates server credentials based on configuration
     */
    private createServerCredentials(): grpc.ServerCredentials {
        if (this.options.secure) {
            if (!this.options.privateKey || !this.options.certChain) {
                throw new Error('Private key and certificate chain are required for secure server');
            }

            return grpc.ServerCredentials.createSsl(
                this.options.rootCerts ?? null,
                [
                    {
                        private_key: this.options.privateKey,
                        cert_chain: this.options.certChain,
                    },
                ],
                false,
            );
        }

        return grpc.ServerCredentials.createInsecure();
    }

    /**
     * Stops the gRPC server gracefully
     */
    private async stopServer(): Promise<void> {
        if (!this.server || !this.isRunning) {
            return;
        }

        return new Promise<void>(resolve => {
            if (!this.server) {
                resolve(); /* istanbul ignore next */
                return;
            }
            this.server.tryShutdown(error => {
                if (error) {
                    this.logger.error('Error during graceful shutdown, forcing shutdown', error);
                    if (this.server) {
                        this.server.forceShutdown();
                    }
                }

                this.isRunning = false;
                this.server = null;
                this.controllerInstances.clear();
                this.registeredServices.clear();
                resolve();
            });
        });
    }

    /**
     * Converts application errors to gRPC errors
     */
    private convertToGrpcError(error: any): any {
        // If already a gRPC error, return as-is
        if (error.code !== undefined && error.message) {
            return error;
        }

        // Convert to gRPC INTERNAL error
        return {
            code: grpc.status.INTERNAL,
            message: error.message ?? 'Internal server error',
            details: error.details ?? 'An unexpected error occurred',
        };
    }

    /**
     * Validates that all registered methods exist in the proto definition
     */
    private validateMethods(serviceName: string, metadata: any, serviceDefinition: any): void {
        this.logger.debug(`Validating methods for service: ${serviceName}`);

        const protoMethods = this.extractProtoMethods(serviceDefinition, serviceName);
        const registeredMethods = Array.from(metadata.methods.keys());

        this.logger.debug(`Proto methods found: ${protoMethods.join(', ')}`);
        this.logger.debug(`Registered methods: ${registeredMethods.join(', ')}`);

        const methodImplementations: Record<string, any> = {};

        for (const [methodName, methodMetadata] of metadata.methods) {
            if (protoMethods.includes(methodName)) {
                // Use original method name from metadata if available, otherwise use camelCase conversion
                const originalMethodName =
                    methodMetadata?.originalMethodName ??
                    methodName.charAt(0).toLowerCase() + methodName.slice(1);
                methodImplementations[methodName] = this.createMethodHandler(
                    serviceName,
                    originalMethodName,
                );
                this.logger.debug(`Method ${methodName} mapped to ${originalMethodName}`);
            } else {
                this.logger.warn(
                    `Method ${methodName} not found in proto definition. Available: ${protoMethods.join(', ')}`,
                );
            }
        }

        if (Object.keys(methodImplementations).length === 0) {
            this.logger.warn(
                `No valid methods found for service ${serviceName}, skipping registration`,
            );
            return;
        }

        try {
            if (!this.server) {
                throw new Error('Server not initialized');
            }
            if (typeof serviceDefinition === 'function' && serviceDefinition.service) {
                this.server.addService(serviceDefinition.service, methodImplementations);
            } else {
                this.server.addService(serviceDefinition, methodImplementations);
            }
            this.logger.debug(
                `Successfully registered service: ${serviceName} with ${Object.keys(methodImplementations).length} methods`,
            );
        } catch (error) {
            this.logger.error(`Failed to register service ${serviceName}:`, error as Error);
            throw error;
        }
    }

    /**
     * Extracts proto methods using multiple strategies to handle different proto structures
     */
    private extractProtoMethods(serviceDefinition: any, serviceName: string): string[] {
        this.logger.debug(`Extracting proto methods for service: ${serviceName}`);

        const methods: string[] = [];

        if (!serviceDefinition) {
            this.logger.debug('Service definition is null/undefined');
            return methods;
        }

        // Strategy 1: Direct service methods
        if (serviceDefinition.service && typeof serviceDefinition.service === 'object') {
            const service = serviceDefinition.service;

            // Check originalName (most common)
            if (service.originalName && typeof service.originalName === 'object') {
                const originalMethods = Object.keys(service.originalName);
                this.logger.debug(
                    `Found methods in service.originalName: ${originalMethods.join(', ')}`,
                );
                methods.push(...originalMethods);
            }

            // Check methods object
            if (service.methods && typeof service.methods === 'object') {
                const methodKeys = Object.keys(service.methods);
                this.logger.debug(`Found methods in service.methods: ${methodKeys.join(', ')}`);
                methods.push(...methodKeys);
            }

            // Check methodsMap
            if (service.methodsMap && typeof service.methodsMap === 'object') {
                const mapKeys = Object.keys(service.methodsMap);
                this.logger.debug(`Found methods in service.methodsMap: ${mapKeys.join(', ')}`);
                methods.push(...mapKeys);
            }

            // Check methods array
            if (service.methods && Array.isArray(service.methods)) {
                const arrayMethods = service.methods
                    .map((method: any) => method.name ?? method.originalName)
                    .filter(Boolean);
                this.logger.debug(
                    `Found methods in service.methods array: ${arrayMethods.join(', ')}`,
                );
                methods.push(...arrayMethods);
            }

            // Strategy 1.5: Direct method keys in service
            const serviceKeys = Object.keys(service);
            const methodKeys = serviceKeys.filter(
                key =>
                    key !== 'originalName' &&
                    key !== 'methods' &&
                    key !== 'methodsMap' &&
                    typeof service[key] === 'object',
            );
            if (methodKeys.length > 0) {
                this.logger.debug(
                    `Found methods as direct keys in service: ${methodKeys.join(', ')}`,
                );
                methods.push(...methodKeys);
            }
        }

        // Strategy 2: Direct function properties (for service constructor)
        if (typeof serviceDefinition === 'function') {
            const functionProps = Object.getOwnPropertyNames(serviceDefinition);
            const methodProps = functionProps.filter(
                prop =>
                    prop !== 'service' &&
                    prop !== 'constructor' &&
                    prop !== 'prototype' &&
                    prop !== 'length' &&
                    prop !== 'name' &&
                    typeof serviceDefinition[prop] === 'object',
            );
            if (methodProps.length > 0) {
                this.logger.debug(
                    `Found methods in function properties: ${methodProps.join(', ')}`,
                );
                methods.push(...methodProps);
            }
        }

        // Strategy 3: Direct object properties
        if (typeof serviceDefinition === 'object') {
            const objectProps = Object.keys(serviceDefinition).filter(
                key =>
                    key !== 'service' &&
                    key !== 'constructor' &&
                    key !== 'prototype' &&
                    typeof serviceDefinition[key] === 'object',
            );
            if (objectProps.length > 0) {
                this.logger.debug(`Found methods in object properties: ${objectProps.join(', ')}`);
                methods.push(...objectProps);
            }
        }

        // Strategy 4: Check if it's a service constructor with methods
        if (typeof serviceDefinition === 'function' && serviceDefinition.service) {
            const service = serviceDefinition.service;
            if (service.originalName) {
                const originalMethods = Object.keys(service.originalName);
                this.logger.debug(
                    `Found methods in service.originalName: ${originalMethods.join(', ')}`,
                );
                methods.push(...originalMethods);
            }
        }

        // Remove duplicates and filter valid method names
        const uniqueMethods = [...new Set(methods)].filter(
            method =>
                method &&
                typeof method === 'string' &&
                method.trim().length > 0 &&
                method !== 'prototype',
        );

        this.logger.debug(`Extracted methods for ${serviceName}: ${uniqueMethods.join(', ')}`);
        return uniqueMethods;
    }
}
