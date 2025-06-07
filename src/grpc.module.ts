import {
    DynamicModule,
    Module,
    Provider,
    Global,
    Type,
    Injectable,
    OnModuleInit,
} from '@nestjs/common';
import { APP_FILTER, DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';

import {
    GRPC_OPTIONS,
    GRPC_CONTROLLER_METADATA,
    GRPC_SERVICE_METADATA,
    GRPC_CLIENT_TOKEN_PREFIX,
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

/**
 * Simple validation for gRPC options
 */
function validateGrpcOptions(options: any): void {
    if (!options || typeof options !== 'object') {
        throw new Error('gRPC options must be a valid object');
    }

    if (!options.protoPath || typeof options.protoPath !== 'string') {
        throw new Error('protoPath is required and must be a string');
    }

    if (!options.package || typeof options.package !== 'string') {
        throw new Error('package is required and must be a string');
    }
}

/**
 * Enhanced NestJS module for gRPC service integration with controller and service support
 */
@Global()
@Module({
    imports: [DiscoveryModule],
})
export class GrpcModule {
    /**
     * Register the module with static options
     * @param options The gRPC options
     * @returns The dynamic module
     */
    static forRoot(options: GrpcOptions): DynamicModule {
        try {
            validateGrpcOptions(options);

            const providers: Provider[] = [
                {
                    provide: GRPC_OPTIONS,
                    useValue: options,
                },
                ProtoLoaderService,
                GrpcClientService,
                {
                    provide: APP_FILTER,
                    useClass: GrpcExceptionFilter,
                },
                // Service for handling controllers and service client registration
                GrpcRegistryService,
            ];

            return {
                module: GrpcModule,
                imports: [DiscoveryModule],
                providers,
                exports: [GrpcClientService, ProtoLoaderService, GRPC_OPTIONS, GrpcRegistryService],
            };
        } catch (error) {
            throw new Error(`Failed to configure GrpcModule: ${error.message}`);
        }
    }

    /**
     * Register the module with async options
     * @param options The async options
     * @returns The dynamic module
     */
    static forRootAsync(options: GrpcModuleAsyncOptions): DynamicModule {
        try {
            if (!options || typeof options !== 'object') {
                throw new Error('Async options must be a valid object');
            }

            const providers: Provider[] = [
                ...this.createAsyncProviders(options),
                ProtoLoaderService,
                GrpcClientService,
                {
                    provide: APP_FILTER,
                    useClass: GrpcExceptionFilter,
                },
                GrpcRegistryService,
            ];

            return {
                module: GrpcModule,
                imports: [DiscoveryModule],
                providers,
                exports: [GrpcClientService, ProtoLoaderService, GRPC_OPTIONS, GrpcRegistryService],
            };
        } catch (error) {
            throw new Error(`Failed to configure GrpcModule async: ${error.message}`);
        }
    }

    /**
     * Register controllers and service clients for a feature module with enhanced dependency injection support
     * @param options Configuration object with controllers, services, providers, and imports
     * @returns The dynamic module
     */
    static forFeature(options: GrpcFeatureOptions = {}): DynamicModule {
        try {
            if (options && typeof options !== 'object') {
                throw new Error('forFeature options must be an object');
            }

            const {
                controllers = [],
                services = [],
                providers = [],
                imports = [],
                exports = [],
            } = options;

            // Validate input arrays
            this.validateFeatureOptions(controllers, services, providers, imports, exports);

            // Create all providers needed for the feature module
            const featureProviders: Provider[] = [
                // Register controllers as providers so they can be injected
                ...controllers,
                // Create gRPC service client providers
                ...this.createServiceClientProviders(services),
                // Add any additional providers specified by the user
                ...providers,
            ];

            // Create exports array
            const featureExports = [
                // Export controllers so they can be used elsewhere
                ...controllers,
                // Export service clients so they can be injected
                ...services,
                // Export any additional exports specified by the user
                ...exports,
            ];

            return {
                module: GrpcModule,
                imports: [
                    // Always import the discovery module for metadata scanning
                    DiscoveryModule,
                    // Add any user-specified imports
                    ...imports,
                ],
                providers: featureProviders,
                controllers, // Register as NestJS controllers
                exports: featureExports,
            };
        } catch (error) {
            throw new Error(`Failed to configure GrpcModule feature: ${error.message}`);
        }
    }

    /**
     * Validates the feature module options
     */
    private static validateFeatureOptions(
        controllers: Type<any>[],
        services: Type<any>[],
        providers: Provider[],
        imports: Array<Type<any> | DynamicModule>,
        exports: Array<Type<any> | string | symbol>,
    ): void {
        // Validate controllers array
        if (!Array.isArray(controllers)) {
            throw new Error('controllers must be an array');
        }

        // Validate services array
        if (!Array.isArray(services)) {
            throw new Error('services must be an array');
        }

        // Validate providers array
        if (!Array.isArray(providers)) {
            throw new Error('providers must be an array');
        }

        // Validate imports array
        if (!Array.isArray(imports)) {
            throw new Error('imports must be an array');
        }

        // Validate exports array
        if (!Array.isArray(exports)) {
            throw new Error('exports must be an array');
        }

        // Validate that controllers have the right metadata
        controllers.forEach((controller, index) => {
            if (!controller || typeof controller !== 'function') {
                throw new Error(`Controller at index ${index} must be a class constructor`);
            }

            if (!Reflect.hasMetadata(GRPC_CONTROLLER_METADATA, controller)) {
                throw new Error(
                    `Controller ${controller.name} must be decorated with @GrpcController`,
                );
            }
        });

        // Validate that services have the right metadata
        services.forEach((service, index) => {
            if (!service || typeof service !== 'function') {
                throw new Error(`Service at index ${index} must be a class constructor`);
            }

            if (!Reflect.hasMetadata(GRPC_SERVICE_METADATA, service)) {
                throw new Error(`Service ${service.name} must be decorated with @GrpcService`);
            }
        });

        // Validate imports
        imports.forEach((importItem, index) => {
            if (!importItem) {
                throw new Error(`Import at index ${index} cannot be null or undefined`);
            }

            // Check if it's a class or a dynamic module
            const isClass = typeof importItem === 'function';
            const isDynamicModule =
                typeof importItem === 'object' && 'module' in importItem && importItem.module;

            if (!isClass && !isDynamicModule) {
                throw new Error(
                    `Import at index ${index} must be a class constructor or dynamic module`,
                );
            }
        });
    }

    /**
     * Creates async providers based on the configuration type
     */
    private static createAsyncProviders(options: GrpcModuleAsyncOptions): Provider[] {
        if (options.useFactory) {
            return [
                {
                    provide: GRPC_OPTIONS,
                    useFactory: async (...args: any[]) => {
                        const grpcOptions = await options.useFactory!(...args);
                        validateGrpcOptions(grpcOptions);
                        return grpcOptions;
                    },
                    inject: options.inject ?? [],
                },
            ];
        }

        if (options.useClass) {
            return [
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
            ];
        }

        if (options.useExisting) {
            return [
                {
                    provide: GRPC_OPTIONS,
                    useFactory: async (optionsFactory: GrpcOptionsFactory) => {
                        const grpcOptions = await optionsFactory.createGrpcOptions();
                        validateGrpcOptions(grpcOptions);
                        return grpcOptions;
                    },
                    inject: [options.useExisting],
                },
            ];
        }

        throw new Error('One of useFactory, useClass, or useExisting must be provided');
    }

    /**
     * Creates providers for service clients with enhanced error handling
     */
    private static createServiceClientProviders(services: Type<any>[]): Provider[] {
        const serviceProviders: Provider[] = [];
        const tokenProviders: Provider[] = [];

        services.forEach(serviceClass => {
            try {
                const metadata: ServiceClientMetadata = Reflect.getMetadata(
                    GRPC_SERVICE_METADATA,
                    serviceClass,
                );

                if (!metadata) {
                    throw new Error(
                        `Service ${serviceClass.name} must be decorated with @GrpcService`,
                    );
                }

                const clientToken = `${GRPC_CLIENT_TOKEN_PREFIX}${metadata.serviceName}`;

                // Provider for the service class
                serviceProviders.push({
                    provide: serviceClass,
                    useFactory: (clientService: GrpcClientService) => {
                        try {
                            const client = clientService.create(
                                metadata.serviceName,
                                metadata.clientOptions,
                            );

                            // Create a proxy object that has the same interface as the service class
                            const serviceInstance = new serviceClass();

                            // Copy all client methods to the service instance
                            if (client && typeof client === 'object') {
                                Object.keys(client as Record<string, any>).forEach(methodName => {
                                    const method = (client as Record<string, any>)[methodName];
                                    if (typeof method === 'function') {
                                        serviceInstance[methodName] = method.bind(client);
                                    }
                                });
                            }

                            return serviceInstance;
                        } catch (error) {
                            throw new Error(
                                `Failed to create gRPC client for service ${metadata.serviceName}: ${error.message}`,
                            );
                        }
                    },
                    inject: [GrpcClientService],
                });

                // Provider for @InjectGrpcClient decorator
                tokenProviders.push({
                    provide: clientToken,
                    useFactory: (clientService: GrpcClientService) => {
                        try {
                            return clientService.create(
                                metadata.serviceName,
                                metadata.clientOptions,
                            );
                        } catch (error) {
                            throw new Error(
                                `Failed to create gRPC client for token ${clientToken}: ${error.message}`,
                            );
                        }
                    },
                    inject: [GrpcClientService],
                });
            } catch (error) {
                throw new Error(
                    `Error creating providers for service ${serviceClass.name}: ${error.message}`,
                );
            }
        });

        return serviceProviders.concat(tokenProviders);
    }
}

/**
 * Service for managing gRPC controllers and service client registration
 */
@Injectable()
class GrpcRegistryService implements OnModuleInit {
    private controllers = new Map<string, ControllerMetadata>();
    private serviceClients = new Map<string, ServiceClientMetadata>();

    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly metadataScanner: MetadataScanner,
    ) {}

    /**
     * Discovers and registers all gRPC controllers and service clients
     */
    async onModuleInit(): Promise<void> {
        try {
            await this.discoverControllers();
            await this.discoverServiceClients();
        } catch (error) {
            console.error('Error during GrpcRegistryService initialization:', error.message);
            throw error;
        }
    }

    /**
     * Discovers all classes decorated with @GrpcController
     */
    private async discoverControllers(): Promise<void> {
        const controllers = this.discoveryService
            .getControllers()
            .filter(
                wrapper =>
                    wrapper.metatype &&
                    Reflect.hasMetadata(GRPC_CONTROLLER_METADATA, wrapper.metatype),
            );

        for (const controller of controllers) {
            try {
                if (
                    controller.metatype &&
                    typeof controller.metatype === 'function' &&
                    'prototype' in controller.metatype
                ) {
                    const metadata: ControllerMetadata = this.extractControllerMetadata(
                        controller.metatype as Type<any>,
                    );
                    this.controllers.set(metadata.serviceName, metadata);
                }
            } catch (error) {
                console.error(
                    `Error registering controller ${controller.metatype?.name ?? 'unknown'}:`,
                    error.message,
                );
            }
        }
    }

    /**
     * Discovers all classes decorated with @GrpcService
     */
    private async discoverServiceClients(): Promise<void> {
        const providers = this.discoveryService
            .getProviders()
            .filter(
                wrapper =>
                    wrapper.metatype &&
                    Reflect.hasMetadata(GRPC_SERVICE_METADATA, wrapper.metatype),
            );

        for (const provider of providers) {
            try {
                if (provider.metatype) {
                    const metadata: ServiceClientMetadata = Reflect.getMetadata(
                        GRPC_SERVICE_METADATA,
                        provider.metatype,
                    );

                    if (metadata) {
                        this.serviceClients.set(metadata.serviceName, metadata);
                    }
                }
            } catch (error) {
                console.error(
                    `Error registering service client ${provider.metatype?.name ?? 'unknown'}:`,
                    error.message,
                );
            }
        }
    }

    /**
     * Extracts controller metadata including methods
     */
    private extractControllerMetadata(controllerClass: Type<any>): ControllerMetadata {
        if (!controllerClass) {
            throw new Error('Controller class is required');
        }

        const controllerMetadata = Reflect.getMetadata(GRPC_CONTROLLER_METADATA, controllerClass);

        if (!controllerMetadata) {
            throw new Error(
                `Controller ${controllerClass.name} is missing @GrpcController metadata`,
            );
        }

        const methods = new Map<string, any>();

        // Scan for methods decorated with @GrpcMethod
        this.metadataScanner.scanFromPrototype(
            controllerClass,
            controllerClass.prototype,
            (methodName: string) => {
                const metadata = Reflect.getMetadata(
                    GRPC_METHOD_METADATA,
                    controllerClass.prototype,
                    methodName,
                );
                if (metadata) {
                    methods.set(methodName, metadata);
                    return true;
                }
                return false;
            },
        );

        return {
            serviceName: controllerMetadata.serviceName,
            package: controllerMetadata.package,
            url: controllerMetadata.url,
            methods,
        };
    }

    /**
     * Gets all registered controllers
     */
    getControllers(): Map<string, ControllerMetadata> {
        return new Map(this.controllers);
    }

    /**
     * Gets all registered service clients
     */
    getServiceClients(): Map<string, ServiceClientMetadata> {
        return new Map(this.serviceClients);
    }

    /**
     * Gets a specific controller by service name
     */
    getController(serviceName: string): ControllerMetadata | undefined {
        return this.controllers.get(serviceName);
    }

    /**
     * Gets a specific service client by service name
     */
    getServiceClient(serviceName: string): ServiceClientMetadata | undefined {
        return this.serviceClients.get(serviceName);
    }
}
