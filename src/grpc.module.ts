import { DynamicModule, Module, Provider, Global } from '@nestjs/common';
import { GrpcClientFactory } from './services/grpc-client.service';
import { ProtoLoaderService } from './services/proto-loader.service';
import { TypeGeneratorService } from './services/type-generator.service';
import { GRPC_OPTIONS } from './constants';
import { GrpcOptions } from './interfaces/grpc-options.interface';
import {
    GrpcModuleAsyncOptions,
    GrpcOptionsFactory,
} from './interfaces/grpc-module-options.interface';

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
        ];

        return {
            module: GrpcModule,
            providers,
            exports: [GrpcClientFactory, TypeGeneratorService],
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
        ];

        return {
            module: GrpcModule,
            imports: options.imports || [],
            providers,
            exports: [GrpcClientFactory, TypeGeneratorService],
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
