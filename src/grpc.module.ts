import {
    DynamicModule,
    Module,
    Provider,
    Global,
    Type,
    Injectable,
    OnModuleInit,
    Inject,
} from '@nestjs/common';
import { APP_FILTER, DiscoveryModule, DiscoveryService } from '@nestjs/core';

import {
    GRPC_OPTIONS,
    GRPC_CONTROLLER_METADATA,
    GRPC_SERVICE_METADATA,
    GRPC_METHOD_METADATA,
} from './constants';
import { GrpcExceptionFilter } from './exceptions/grpc.exception-filter';
import {
    GrpcOptions,
    GrpcModuleAsyncOptions,
    GrpcOptionsFactory,
    GrpcFeatureOptions,
    ControllerMetadata,
    ServiceClientMetadata,
} from './interfaces';
import { GrpcClientService } from './services/grpc-client.service';
import { ProtoLoaderService } from './services/proto-loader.service';
import { GrpcLogger } from './utils/logger';

/**
 * Validates gRPC configuration options
 */
function validateGrpcOptions(options: any): asserts options is GrpcOptions {
    if (!options || typeof options !== 'object') {
        throw new Error('gRPC options must be a valid object');
    }

    if (!options.protoPath || typeof options.protoPath !== 'string') {
        throw new Error('protoPath is required and must be a string');
    }

    if (!options.package || typeof options.package !== 'string') {
        throw new Error('package is required and must be a string');
    }

    if (options.url && typeof options.url !== 'string') {
        throw new Error('url must be a string');
    }

    if (
        options.maxSendMessageSize !== undefined &&
        (typeof options.maxSendMessageSize !== 'number' || options.maxSendMessageSize <= 0)
    ) {
        throw new Error('maxSendMessageSize must be a positive number');
    }

    if (
        options.maxReceiveMessageSize !== undefined &&
        (typeof options.maxReceiveMessageSize !== 'number' || options.maxReceiveMessageSize <= 0)
    ) {
        throw new Error('maxReceiveMessageSize must be a positive number');
    }
}

/**
 * Global gRPC module for NestJS applications that provides comprehensive
 * gRPC client and server functionality with automatic service discovery.
 *
 * Use forRoot() for basic configuration, forRootAsync() for dynamic configuration,
 * and forFeature() for feature modules with specific controllers and services.
 */
@Global()
@Module({
    imports: [DiscoveryModule],
})
export class GrpcModule {
    /**
     * Validates gRPC configuration options (exposed for testing)
     */
    static validateGrpcOptions = validateGrpcOptions;

    /**
     * Configure the gRPC module with static options
     */
    static forRoot(options: GrpcOptions): DynamicModule {
        validateGrpcOptions(options);

        const providers: Provider[] = [
            {
                provide: GRPC_OPTIONS,
                useValue: options,
            },
            ProtoLoaderService,
            GrpcClientService,
            GrpcRegistryService,
            {
                provide: APP_FILTER,
                useFactory: () => new GrpcExceptionFilter(),
            },
        ];

        return {
            module: GrpcModule,
            global: true,
            imports: [DiscoveryModule],
            providers,
            exports: [GRPC_OPTIONS, ProtoLoaderService, GrpcClientService, GrpcRegistryService],
        };
    }

    /**
     * Configure the gRPC module with async options
     */
    static forRootAsync(options: GrpcModuleAsyncOptions): DynamicModule {
        if (!options || typeof options !== 'object') {
            throw new Error('Async options must be a valid object');
        }

        const providers: Provider[] = [
            ...this.createAsyncProviders(options),
            ...(options.providers ?? []),
            ProtoLoaderService,
            GrpcClientService,
            GrpcRegistryService,
            {
                provide: APP_FILTER,
                useFactory: () => new GrpcExceptionFilter(),
            },
        ];

        return {
            module: GrpcModule,
            global: true,
            imports: [DiscoveryModule, ...(options.imports ?? [])],
            providers,
            exports: [GRPC_OPTIONS, ProtoLoaderService, GrpcClientService, GrpcRegistryService],
        };
    }

    /**
     * Creates async providers based on the configuration strategy
     */
    private static createAsyncProviders(options: GrpcModuleAsyncOptions): Provider[] {
        const providers: Provider[] = [];

        if (options.useFactory) {
            providers.push({
                provide: GRPC_OPTIONS,
                useFactory: async (...args: any[]) => {
                    const grpcOptions = await (options.useFactory as Function)(...args);
                    validateGrpcOptions(grpcOptions);
                    return grpcOptions;
                },
                inject: options.inject ?? [],
            });
        } else if (options.useClass) {
            providers.push(
                {
                    provide: options.useClass,
                    useClass: options.useClass,
                },
                {
                    provide: GRPC_OPTIONS,
                    useFactory: async (optionsFactory: GrpcOptionsFactory) => {
                        const grpcOptions = await optionsFactory.createGrpcOptions();
                        validateGrpcOptions(grpcOptions);
                        return grpcOptions;
                    },
                    inject: [options.useClass],
                },
            );
        } else if (options.useExisting) {
            providers.push({
                provide: GRPC_OPTIONS,
                useFactory: async (optionsFactory: GrpcOptionsFactory) => {
                    const grpcOptions = await optionsFactory.createGrpcOptions();
                    validateGrpcOptions(grpcOptions);
                    return grpcOptions;
                },
                inject: [options.useExisting],
            });
        } else {
            throw new Error('One of useFactory, useClass, or useExisting must be provided');
        }

        return providers;
    }

    /**
     * Register gRPC feature modules with controllers and services
     */
    static forFeature(options: GrpcFeatureOptions = {}): DynamicModule {
        const providers: Provider[] = [];
        const controllers = options.controllers ?? [];
        const services = options.services ?? [];

        // Add service providers for client injection
        for (const serviceClass of services) {
            providers.push(serviceClass);
        }

        return {
            module: GrpcModule,
            controllers,
            providers,
            exports: [...services],
        };
    }
}

/**
 * Service responsible for discovering and registering gRPC controllers and services
 */
@Injectable()
export class GrpcRegistryService implements OnModuleInit {
    private readonly logger: GrpcLogger;
    private readonly controllers = new Map<string, ControllerMetadata>();
    private readonly serviceClients = new Map<string, ServiceClientMetadata>();

    constructor(
        private readonly discoveryService: DiscoveryService,
        @Inject(GRPC_OPTIONS) private readonly options: GrpcOptions,
    ) {
        this.logger = new GrpcLogger({
            ...options.logging,
            context: 'GrpcRegistry',
        });
    }

    /**
     * Lifecycle hook - discovers and registers gRPC components on module initialization
     */
    onModuleInit(): void {
        this.logger.lifecycle('Starting gRPC service discovery');

        this.discoverControllers();
        this.discoverServiceClients();

        this.logger.lifecycle('gRPC service discovery completed', {
            controllers: this.controllers.size,
            serviceClients: this.serviceClients.size,
        });

        if (this.options.logging?.level === 'debug') {
            const controllerNames = Array.from(this.controllers.keys());
            const serviceClientNames = Array.from(this.serviceClients.keys());

            if (controllerNames.length > 0) {
                this.logger.debug(`Controllers: ${controllerNames.join(', ')}`);
            }
            if (serviceClientNames.length > 0) {
                this.logger.debug(`Service clients: ${serviceClientNames.join(', ')}`);
            }
        }
    }

    /**
     * Get all registered gRPC controllers
     */
    getControllers(): ReadonlyMap<string, ControllerMetadata> {
        return this.controllers;
    }

    /**
     * Get all registered gRPC service clients
     */
    getServiceClients(): ReadonlyMap<string, ServiceClientMetadata> {
        return this.serviceClients;
    }

    /**
     * Get a specific controller by service name
     */
    getController(serviceName: string): ControllerMetadata | undefined {
        return this.controllers.get(serviceName);
    }

    /**
     * Get a specific service client by service name
     */
    getServiceClient(serviceName: string): ServiceClientMetadata | undefined {
        return this.serviceClients.get(serviceName);
    }

    /**
     * Discovers all classes decorated with @GrpcController
     */
    private discoverControllers(): void {
        const controllerWrappers = this.discoveryService
            .getControllers()
            .filter(
                wrapper =>
                    wrapper.metatype &&
                    Reflect.hasMetadata(GRPC_CONTROLLER_METADATA, wrapper.metatype),
            );

        for (const wrapper of controllerWrappers) {
            const className = wrapper.metatype?.name ?? 'Unknown';

            try {
                const controllerClass = wrapper.metatype as Type<any>;
                const metadata = this.extractControllerMetadata(controllerClass);

                if (this.controllers.has(metadata.serviceName)) {
                    this.logger.warn(
                        `Controller ${metadata.serviceName} already registered, skipping duplicate`,
                    );
                    continue;
                }

                this.controllers.set(metadata.serviceName, metadata);

                this.logger.lifecycle(`Registered controller: ${metadata.serviceName}`, {
                    methods: metadata.methods.size,
                    className,
                });
            } catch (error) {
                this.logger.error(`Failed to register controller ${className}`, error);
            }
        }
    }

    /**
     * Discovers all classes decorated with @GrpcService
     */
    private discoverServiceClients(): void {
        const serviceWrappers = this.discoveryService
            .getProviders()
            .filter(
                wrapper =>
                    wrapper.metatype &&
                    Reflect.hasMetadata(GRPC_SERVICE_METADATA, wrapper.metatype),
            );

        for (const wrapper of serviceWrappers) {
            const className = wrapper.metatype?.name ?? 'Unknown';

            try {
                const serviceClass = wrapper.metatype as Type<any>;
                const metadata: ServiceClientMetadata = Reflect.getMetadata(
                    GRPC_SERVICE_METADATA,
                    serviceClass,
                );

                if (!metadata) {
                    this.logger.warn(`Service class ${className} has no valid metadata`);
                    continue;
                }

                if (this.serviceClients.has(metadata.serviceName)) {
                    this.logger.warn(
                        `Service client ${metadata.serviceName} already registered, skipping duplicate`,
                    );
                    continue;
                }

                this.serviceClients.set(metadata.serviceName, metadata);
                this.logger.lifecycle(`Registered service client: ${metadata.serviceName}`, {
                    className,
                });
            } catch (error) {
                this.logger.error(`Failed to register service client ${className}`, error);
            }
        }
    }

    /**
     * Extracts metadata from a gRPC controller class
     */
    private extractControllerMetadata(controllerClass: Type<any>): ControllerMetadata {
        const controllerMetadata = Reflect.getMetadata(GRPC_CONTROLLER_METADATA, controllerClass);

        if (!controllerMetadata) {
            throw new Error(`Missing @GrpcController metadata on ${controllerClass.name}`);
        }

        const methods = new Map<string, any>();

        // Get all property names from the prototype
        const prototype = controllerClass.prototype;
        const methodNames = Object.getOwnPropertyNames(prototype).filter(
            name => name !== 'constructor' && typeof prototype[name] === 'function',
        );

        // Check each method for gRPC metadata
        for (const methodName of methodNames) {
            const methodMetadata = Reflect.getMetadata(GRPC_METHOD_METADATA, prototype, methodName);

            if (methodMetadata) {
                methods.set(methodName, methodMetadata);
                this.logger.debug(`Found gRPC method: ${controllerClass.name}.${methodName}`);
            }
        }

        return {
            serviceName: controllerMetadata.serviceName,
            package: controllerMetadata.package,
            url: controllerMetadata.url,
            methods,
        };
    }
}
