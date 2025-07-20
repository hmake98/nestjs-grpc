import 'reflect-metadata';

import { DynamicModule, Module, Provider, Global } from '@nestjs/common';
import { APP_FILTER, DiscoveryModule } from '@nestjs/core';

import { GRPC_OPTIONS } from './constants';
import { GrpcConsumerErrorHandler } from './exceptions/grpc.exception';
import { GrpcExceptionFilter } from './exceptions/grpc.exception-filter';
import {
    GrpcOptions,
    GrpcModuleAsyncOptions,
    GrpcOptionsFactory,
    GrpcConsumerOptions,
    GrpcConsumerOptionsFactory,
    GrpcConsumerModuleAsyncOptions,
} from './interfaces';
import { GrpcClientService } from './services/grpc-client.service';
import { GrpcControllerDiscoveryService } from './services/grpc-controller-discovery.service';
import { GrpcProtoService } from './services/grpc-proto.service';
import { GrpcProviderService } from './services/grpc-provider.service';
import { GrpcRegistryService } from './services/grpc-registry.service';

/**
 * Global gRPC module for NestJS applications that provides comprehensive
 * gRPC client and server functionality.
 *
 * Use forProvider() for server-side configuration and forConsumer() for client-side configuration.
 * Both support sync and async configurations.
 */
@Global()
@Module({
    imports: [DiscoveryModule],
})
export class GrpcModule {
    /**
     * Configure the gRPC module as a provider (server-side) with static options
     */
    static forProvider(options: GrpcOptions): DynamicModule {
        this.validateGrpcOptions(options);

        const providers: Provider[] = [
            {
                provide: GRPC_OPTIONS,
                useValue: options,
            },
            GrpcProtoService,
            GrpcClientService,
            GrpcProviderService,
            GrpcRegistryService,
            GrpcControllerDiscoveryService,
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
            exports: [
                GRPC_OPTIONS,
                GrpcProtoService,
                GrpcClientService,
                GrpcProviderService,
                GrpcRegistryService,
                GrpcControllerDiscoveryService,
            ],
        };
    }

    /**
     * Configure the gRPC module as a provider (server-side) with async options
     */
    static forProviderAsync(options: GrpcModuleAsyncOptions): DynamicModule {
        if (!options || typeof options !== 'object') {
            throw new Error('Async options must be a valid object');
        }

        const providers: Provider[] = [
            ...this.createAsyncProviders(options),
            ...(options.providers ?? []),
            GrpcProtoService,
            GrpcClientService,
            GrpcProviderService,
            GrpcRegistryService,
            GrpcControllerDiscoveryService,
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
            exports: [
                GRPC_OPTIONS,
                GrpcProtoService,
                GrpcClientService,
                GrpcProviderService,
                GrpcRegistryService,
                GrpcControllerDiscoveryService,
            ],
        };
    }

    /**
     * Configure the gRPC module as a consumer (client-side) with static options
     */
    static forConsumer(options: GrpcConsumerOptions): DynamicModule {
        this.validateConsumerOptions(options);

        const providers: Provider[] = [
            {
                provide: GRPC_OPTIONS,
                useValue: options,
            },
            {
                provide: GRPC_OPTIONS,
                useValue: {
                    protoPath: options.protoPath,
                    package: options.package,
                    url: options.url,
                    secure: options.secure,
                    rootCerts: options.rootCerts,
                    privateKey: options.privateKey,
                    certChain: options.certChain,
                    loaderOptions: options.loaderOptions,
                    logging: options.logging,
                },
            },
            GrpcProtoService,
            GrpcClientService,
            GrpcConsumerErrorHandler,
        ];

        return {
            module: GrpcModule,
            imports: [DiscoveryModule],
            providers,
            exports: [GrpcClientService, GrpcConsumerErrorHandler],
        };
    }

    /**
     * Configure the gRPC module as a consumer (client-side) with async options
     */
    static forConsumerAsync(options: GrpcConsumerModuleAsyncOptions): DynamicModule {
        if (!options || typeof options !== 'object') {
            throw new Error('Async consumer options must be a valid object');
        }

        const providers: Provider[] = [
            ...this.createConsumerAsyncProviders(options),
            ...(options.providers ?? []),
            GrpcProtoService,
            GrpcClientService,
            GrpcConsumerErrorHandler,
        ];

        return {
            module: GrpcModule,
            imports: [DiscoveryModule, ...(options.imports ?? [])],
            providers,
            exports: [GrpcClientService, GrpcConsumerErrorHandler],
        };
    }

    /**
     * Creates async providers based on the configuration strategy
     */
    private static createAsyncProviders(options: GrpcModuleAsyncOptions): Provider[] {
        const providers: Provider[] = [];

        if (options.useFactory && typeof options.useFactory === 'function') {
            providers.push({
                provide: GRPC_OPTIONS,
                useFactory: async (...args: any[]) => {
                    const grpcOptions = await (options.useFactory as Function)(...args);
                    this.validateGrpcOptions(grpcOptions);
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
                        this.validateGrpcOptions(grpcOptions);
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
                    this.validateGrpcOptions(grpcOptions);
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
     * Creates async providers for consumer modules
     */
    private static createConsumerAsyncProviders(
        options: GrpcConsumerModuleAsyncOptions,
    ): Provider[] {
        const providers: Provider[] = [];

        if (options.useFactory && typeof options.useFactory === 'function') {
            providers.push(
                {
                    provide: GRPC_OPTIONS,
                    useFactory: async (...args: any[]) => {
                        const consumerOptions = await (options.useFactory as Function)(...args);
                        this.validateConsumerOptions(consumerOptions);
                        return consumerOptions;
                    },
                    inject: options.inject ?? [],
                },
                {
                    provide: GRPC_OPTIONS,
                    useFactory: async (...args: any[]) => {
                        const consumerOptions = await (options.useFactory as Function)(...args);
                        return {
                            protoPath: consumerOptions.protoPath,
                            package: consumerOptions.package,
                            url: consumerOptions.url,
                            secure: consumerOptions.secure,
                            rootCerts: consumerOptions.rootCerts,
                            privateKey: consumerOptions.privateKey,
                            certChain: consumerOptions.certChain,
                            loaderOptions: consumerOptions.loaderOptions,
                            logging: consumerOptions.logging,
                        };
                    },
                    inject: options.inject ?? [],
                },
            );
        } else if (options.useClass) {
            providers.push(
                {
                    provide: options.useClass,
                    useClass: options.useClass,
                },
                {
                    provide: GRPC_OPTIONS,
                    useFactory: async (optionsFactory: GrpcConsumerOptionsFactory) => {
                        const consumerOptions = await optionsFactory.createGrpcConsumerOptions();
                        this.validateConsumerOptions(consumerOptions);
                        return consumerOptions;
                    },
                    inject: [options.useClass],
                },
                {
                    provide: GRPC_OPTIONS,
                    useFactory: async (optionsFactory: GrpcConsumerOptionsFactory) => {
                        const consumerOptions = await optionsFactory.createGrpcConsumerOptions();
                        return {
                            protoPath: consumerOptions.protoPath,
                            package: consumerOptions.package,
                            url: consumerOptions.url,
                            secure: consumerOptions.secure,
                            rootCerts: consumerOptions.rootCerts,
                            privateKey: consumerOptions.privateKey,
                            certChain: consumerOptions.certChain,
                            loaderOptions: consumerOptions.loaderOptions,
                            logging: consumerOptions.logging,
                        };
                    },
                    inject: [options.useClass],
                },
            );
        } else if (options.useExisting) {
            providers.push(
                {
                    provide: GRPC_OPTIONS,
                    useFactory: async (optionsFactory: GrpcConsumerOptionsFactory) => {
                        const consumerOptions = await optionsFactory.createGrpcConsumerOptions();
                        this.validateConsumerOptions(consumerOptions);
                        return consumerOptions;
                    },
                    inject: [options.useExisting],
                },
                {
                    provide: GRPC_OPTIONS,
                    useFactory: async (optionsFactory: GrpcConsumerOptionsFactory) => {
                        const consumerOptions = await optionsFactory.createGrpcConsumerOptions();
                        return {
                            protoPath: consumerOptions.protoPath,
                            package: consumerOptions.package,
                            url: consumerOptions.url,
                            secure: consumerOptions.secure,
                            rootCerts: consumerOptions.rootCerts,
                            privateKey: consumerOptions.privateKey,
                            certChain: consumerOptions.certChain,
                            loaderOptions: consumerOptions.loaderOptions,
                            logging: consumerOptions.logging,
                        };
                    },
                    inject: [options.useExisting],
                },
            );
        } else {
            throw new Error('One of useFactory, useClass, or useExisting must be provided');
        }

        return providers;
    }

    /**
     * Validates consumer options
     */
    private static validateConsumerOptions(options: any): asserts options is GrpcConsumerOptions {
        if (!options || typeof options !== 'object') {
            throw new Error('Consumer options must be a valid object');
        }

        if (!options.protoPath || typeof options.protoPath !== 'string') {
            throw new Error('protoPath is required and must be a string');
        }

        if (!options.package || typeof options.package !== 'string') {
            throw new Error('package is required and must be a string');
        }

        if (!options.url || typeof options.url !== 'string') {
            throw new Error('url is required and must be a string');
        }
    }

    /**
     * Validates gRPC configuration options
     */
    private static validateGrpcOptions(options: any): asserts options is GrpcOptions {
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
            (typeof options.maxReceiveMessageSize !== 'number' ||
                options.maxReceiveMessageSize <= 0)
        ) {
            throw new Error('maxReceiveMessageSize must be a positive number');
        }
    }
}
