import { DynamicModule, Module, Provider, Global } from '@nestjs/common';
import { APP_FILTER, DiscoveryModule } from '@nestjs/core';

import { GRPC_OPTIONS } from './constants';
import { GrpcExceptionFilter } from './exceptions/grpc.exception-filter';
import { GrpcOptions, GrpcModuleAsyncOptions, GrpcOptionsFactory } from './interfaces';
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
 * Enhanced NestJS module for gRPC service integration
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
            ];

            return {
                module: GrpcModule,
                imports: [DiscoveryModule],
                providers,
                exports: [GrpcClientService, GRPC_OPTIONS],
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
            ];

            return {
                module: GrpcModule,
                imports: [DiscoveryModule],
                providers,
                exports: [GrpcClientService, GRPC_OPTIONS],
            };
        } catch (error) {
            throw new Error(`Failed to configure GrpcModule async: ${error.message}`);
        }
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
}
