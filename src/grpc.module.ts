import { DynamicModule, Module, Provider, Global } from '@nestjs/common';
import { APP_FILTER, DiscoveryModule } from '@nestjs/core';
import { GrpcClientFactory } from './services/grpc-client.service';
import { ProtoLoaderService } from './services/proto-loader.service';
import { GRPC_OPTIONS } from './constants';
import { GrpcOptions, GrpcModuleAsyncOptions } from './interfaces';
import { GrpcExceptionFilter } from './exceptions/grpc.exception-filter';

/**
 * NestJS module for gRPC service integration
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
        const providers: Provider[] = [
            {
                provide: GRPC_OPTIONS,
                useValue: options,
            },
            ProtoLoaderService,
            GrpcClientFactory,
            {
                provide: APP_FILTER,
                useClass: GrpcExceptionFilter,
            },
        ];

        return {
            module: GrpcModule,
            imports: [DiscoveryModule],
            providers,
            exports: [GrpcClientFactory, GRPC_OPTIONS],
        };
    }

    /**
     * Register the module with async options
     * @param options The async options
     * @returns The dynamic module
     */
    static forRootAsync(options: GrpcModuleAsyncOptions): DynamicModule {
        const providers: Provider[] = [
            {
                provide: GRPC_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject || [],
            },
            ProtoLoaderService,
            GrpcClientFactory,
            {
                provide: APP_FILTER,
                useClass: GrpcExceptionFilter,
            },
        ];

        return {
            module: GrpcModule,
            imports: [DiscoveryModule],
            providers,
            exports: [GrpcClientFactory, GRPC_OPTIONS],
        };
    }
}
