import { DynamicModule, Module, Provider, Global } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GrpcClientFactory } from './services/grpc-client.service';
import { ProtoLoaderService } from './services/proto-loader.service';
import { TypeGeneratorService } from './services/type-generator.service';
import { GRPC_OPTIONS } from './constants';
import { GrpcOptions } from './interfaces/grpc-options.interface';
import {
    GrpcModuleAsyncOptions,
    GrpcOptionsFactory,
} from './interfaces/grpc-module-options.interface';
import { GrpcExceptionFilter } from './exceptions/grpc.exception-filter';
import { GrpcMetadataExplorer } from './metadata/metadata.explorer';

@Global()
@Module({})
export class GrpcModule {
    /**
     * Register the module with static options
     * @param options The gRPC options
     * @returns The dynamic module
     */
    static forRoot(options: GrpcOptions): DynamicModule {
        const providers: Provider[] = [
            {
                provide: GRPC_OPTIONS,
                useValue: options,
            },
            ProtoLoaderService,
            TypeGeneratorService,
            GrpcClientFactory,
            GrpcMetadataExplorer,
            {
                provide: APP_FILTER,
                useClass: GrpcExceptionFilter,
            },
        ];

        return {
            module: GrpcModule,
            providers,
            exports: [GrpcClientFactory, TypeGeneratorService, GrpcMetadataExplorer],
        };
    }

    /**
     * Register the module with async options
     * @param options The async options
     * @returns The dynamic module
     */
    static forRootAsync(options: GrpcModuleAsyncOptions): DynamicModule {
        const providers: Provider[] = [
            ...this.createAsyncProviders(options),
            ProtoLoaderService,
            TypeGeneratorService,
            GrpcClientFactory,
            GrpcMetadataExplorer,
            {
                provide: APP_FILTER,
                useClass: GrpcExceptionFilter,
            },
        ];

        return {
            module: GrpcModule,
            imports: options.imports || [],
            providers,
            exports: [GrpcClientFactory, TypeGeneratorService, GrpcMetadataExplorer],
        };
    }

    /**
     * Creates providers for async options
     * @param options The async options
     * @returns The providers
     */
    private static createAsyncProviders(options: GrpcModuleAsyncOptions): Provider[] {
        if (options.useExisting || options.useFactory) {
            return [this.createAsyncOptionsProvider(options)];
        }

        return [
            this.createAsyncOptionsProvider(options),
            {
                provide: options.useClass,
                useClass: options.useClass,
            },
        ];
    }

    /**
     * Creates the async options provider
     * @param options The async options
     * @returns The provider
     */
    private static createAsyncOptionsProvider(options: GrpcModuleAsyncOptions): Provider {
        if (options.useFactory) {
            return {
                provide: GRPC_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject || [],
            };
        }

        return {
            provide: GRPC_OPTIONS,
            useFactory: async (optionsFactory: GrpcOptionsFactory) =>
                await optionsFactory.createGrpcOptions(),
            inject: [options.useExisting || options.useClass],
        };
    }
}
