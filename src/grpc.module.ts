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
import { APP_FILTER, DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';

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

    if (options.url && typeof options.url !== 'string') {
        throw new Error('url must be a string');
    }
}

/**
 * Global gRPC module for NestJS applications with simple logging
 */
@Global()
@Module({
    imports: [DiscoveryModule],
})
export class GrpcModule {
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
                useClass: GrpcExceptionFilter,
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
            ProtoLoaderService,
            GrpcClientService,
            GrpcRegistryService,
            {
                provide: APP_FILTER,
                useClass: GrpcExceptionFilter,
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
 * with enhanced logging capabilities
 */
@Injectable()
export class GrpcRegistryService implements OnModuleInit {
    private readonly logger: GrpcLogger;
    private readonly controllers = new Map<string, ControllerMetadata>();
    private readonly serviceClients = new Map<string, ServiceClientMetadata>();

    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly metadataScanner: MetadataScanner,
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
        try {
            this.logger.log('Starting gRPC service discovery...');

            this.discoverControllers();
            this.discoverServiceClients();

            this.logger.log(
                `Discovered ${this.controllers.size} controllers, ${this.serviceClients.size} service clients`,
            );

            this.logger.debug('Controllers:', Array.from(this.controllers.keys()).join(', '));
            this.logger.debug(
                'Service clients:',
                Array.from(this.serviceClients.keys()).join(', '),
            );
        } catch (error) {
            this.logger.error('Failed to initialize GrpcRegistryService', error);
            throw error;
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
            try {
                const controllerClass = wrapper.metatype as Type<any>;
                const metadata = this.extractControllerMetadata(controllerClass);
                this.controllers.set(metadata.serviceName, metadata);

                this.logger.log(`Registered controller: ${metadata.serviceName}`);
            } catch (error) {
                const className = wrapper.metatype?.name ?? 'Unknown';
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
            try {
                const serviceClass = wrapper.metatype as Type<any>;
                const metadata: ServiceClientMetadata = Reflect.getMetadata(
                    GRPC_SERVICE_METADATA,
                    serviceClass,
                );

                if (metadata) {
                    this.serviceClients.set(metadata.serviceName, metadata);
                    this.logger.log(`Registered service client: ${metadata.serviceName}`);
                }
            } catch (error) {
                const className = wrapper.metatype?.name ?? 'Unknown';
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

        // Scan for methods decorated with @GrpcMethod
        this.metadataScanner.scanFromPrototype(
            controllerClass,
            controllerClass.prototype,
            (methodName: string) => {
                const methodMetadata = Reflect.getMetadata(
                    GRPC_METHOD_METADATA,
                    controllerClass.prototype,
                    methodName,
                );

                if (methodMetadata) {
                    methods.set(methodName, methodMetadata);
                    this.logger.debug(`Found gRPC method: ${controllerClass.name}.${methodName}`);
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
}
