import { DynamicModule, Module, Provider, Global } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GrpcClientFactory } from './services/grpc-client.service';
import { ProtoLoaderService } from './services/proto-loader.service';
import { TypeGeneratorService } from './services/type-generator.service';
import { GrpcLoggerService } from './services/logger.service';
import { GRPC_LOGGER, GRPC_OPTIONS } from './constants';
import { GrpcOptions } from './interfaces/grpc-options.interface';
import {
    GrpcModuleAsyncOptions,
    GrpcOptionsFactory,
} from './interfaces/grpc-module-options.interface';
import { GrpcExceptionFilter } from './exceptions/grpc.exception-filter';
import { GrpcMetadataExplorer } from './metadata/metadata.explorer';
import { GrpcLogger, LogLevel } from './interfaces/logger.interface';

@Global()
@Module({})
export class GrpcModule {
    /**
     * Register the module with static options
     * @param options The gRPC options
     * @returns The dynamic module
     */
    static forRoot(options: GrpcOptions): DynamicModule {
        const loggerProvider = this.createLoggerProvider(options);

        const providers: Provider[] = [
            {
                provide: GRPC_OPTIONS,
                useValue: options,
            },
            loggerProvider,
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
            exports: [GrpcClientFactory, TypeGeneratorService, GrpcMetadataExplorer, GRPC_LOGGER],
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
            {
                provide: GRPC_LOGGER,
                useFactory: (grpcOptions: GrpcOptions) => {
                    return this.createLogger(grpcOptions);
                },
                inject: [GRPC_OPTIONS],
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
            imports: options.imports || [],
            providers,
            exports: [GrpcClientFactory, TypeGeneratorService, GrpcMetadataExplorer, GRPC_LOGGER],
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

        // Only add this provider if useClass is defined
        if (options.useClass) {
            return [
                this.createAsyncOptionsProvider(options),
                {
                    provide: options.useClass,
                    useClass: options.useClass,
                },
            ];
        }

        return [this.createAsyncOptionsProvider(options)];
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

        // Handle the case when neither useExisting nor useClass is defined
        const injectToken = options.useExisting || options.useClass;

        if (!injectToken) {
            throw new Error(
                'Invalid configuration. If "useFactory" is not used, you must provide "useExisting" or "useClass".',
            );
        }

        return {
            provide: GRPC_OPTIONS,
            useFactory: async (optionsFactory: GrpcOptionsFactory) =>
                await optionsFactory.createGrpcOptions(),
            inject: [injectToken],
        };
    }

    /**
     * Creates a logger provider
     * @param options The gRPC options
     * @returns The logger provider
     */
    private static createLoggerProvider(options: GrpcOptions): Provider {
        return {
            provide: GRPC_LOGGER,
            useValue: this.createLogger(options),
        };
    }

    /**
     * Creates a logger instance
     * @param options The gRPC options
     * @returns A logger instance
     */
    private static createLogger(options: GrpcOptions): GrpcLogger {
        const loggerOptions = options.logger || {};

        // If a custom logger is provided, use it
        if (loggerOptions.customLogger) {
            return loggerOptions.customLogger;
        }

        // Otherwise, create a default logger
        return new GrpcLoggerService('GrpcModule', {
            level: loggerOptions.level || LogLevel.INFO,
            prettyPrint: loggerOptions.prettyPrint !== false,
            disable: loggerOptions.disable || false,
        });
    }
}
