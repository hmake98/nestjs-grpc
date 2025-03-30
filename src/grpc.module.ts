import { DynamicModule, Module, Provider, Global, Type } from '@nestjs/common';
import { APP_FILTER, DiscoveryModule } from '@nestjs/core';
import { GrpcClientFactory } from './services/grpc-client.service';
import { ProtoLoaderService } from './services/proto-loader.service';
import { TypeGeneratorService } from './services/type-generator.service';
import { GrpcLoggerService } from './services/logger.service';
import { GRPC_LOGGER, GRPC_OPTIONS } from './constants';
import { GrpcDashboardOptions, GrpcOptions } from './interfaces';
import {
    GrpcModuleAsyncOptions,
    GrpcOptionsFactory,
} from './interfaces/grpc-module-options.interface';
import { GrpcExceptionFilter } from './exceptions/grpc.exception-filter';
import { GrpcLogger, LogLevel } from './interfaces/logger.interface';
import { GrpcDashboardController } from './dashboard/dashboard.controller';
import { GrpcDashboardService } from './dashboard/dashboard.service';
import { GrpcDashboardGateway } from './dashboard';

/**
 * Example usage of GrpcModule:
 *
 * 1. Using forRoot with static options and dashboard:
 *
 * ```typescript
 * // app.module.ts
 * import { Module } from '@nestjs/common';
 * import { GrpcModule } from 'nestjs-grpc';
 * import { join } from 'path';
 *
 * @Module({
 *   imports: [
 *     GrpcModule.forRoot({
 *       protoPath: join(__dirname, 'protos/service.proto'),
 *       package: 'example.service',
 *       url: 'localhost:50051',
 *       // Dashboard configuration
 *       dashboard: {
 *         enable: true,
 *         apiPrefix: 'grpc-dashboard/api',
 *         maxLogs: 1000,
 *         cors: { origin: '*' }
 *       }
 *     }),
 *     // Other modules
 *   ],
 *   controllers: [],
 *   providers: [],
 * })
 * export class AppModule {}
 *
 *
 * 2. Using forRootAsync with factory and dashboard:
 *
 * ```typescript
 * // app.module.ts
 * import { Module } from '@nestjs/common';
 * import { ConfigModule, ConfigService } from '@nestjs/config';
 * import { GrpcModule } from 'nestjs-grpc';
 * import { join } from 'path';
 *
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot(),
 *     GrpcModule.forRootAsync({
 *       imports: [ConfigModule],
 *       inject: [ConfigService],
 *       useFactory: (configService: ConfigService) => ({
 *         protoPath: join(__dirname, 'protos/service.proto'),
 *         package: 'example.service',
 *         url: configService.get<string>('GRPC_URL'),
 *         secure: configService.get<boolean>('GRPC_SECURE'),
 *         dashboard: {
 *           enable: configService.get<boolean>('ENABLE_DASHBOARD', true),
 *           apiPrefix: configService.get<string>('DASHBOARD_PREFIX', 'grpc-dashboard/api'),
 *         }
 *       }),
 *     }),
 *     // Other modules
 *   ],
 *   controllers: [],
 *   providers: [],
 * })
 * export class AppModule {}
 * ```
 *
 * 3. Creating a gRPC service:
 *
 * ```typescript
 * // hero.controller.ts
 * import { Controller } from '@nestjs/common';
 * import { GrpcService, GrpcMethod } from 'nestjs-grpc';
 * import { Hero, HeroById } from './interfaces/hero.interface';
 *
 * @Controller()
 * @GrpcService({
 *   serviceName: 'HeroService',
 *   package: 'hero',
 * })
 * export class HeroController {
 *   private heroes: Hero[] = [
 *     { id: 1, name: 'John' },
 *     { id: 2, name: 'Doe' },
 *   ];
 *
 *   @GrpcMethod('FindOne')
 *   findOne(data: HeroById): Hero {
 *     return this.heroes.find(({ id }) => id === data.id);
 *   }
 * }
 * ```
 *
 * 4. Dashboard access:
 * The dashboard will be available at the configured apiPrefix (default: `/grpc-dashboard/api`).
 * The following endpoints are available:
 * - `GET /services` - List all gRPC services
 * - `GET /services/:id` - Get details for a specific service
 * - `GET /connections` - List all active gRPC connections
 * - `GET /logs` - Get recent logs with optional filtering
 * - `GET /stats` - Get request statistics
 * - `GET /info` - Get basic system info
 *
 * WebSocket events are also available at `/grpc-dashboard` namespace.
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
            {
                provide: APP_FILTER,
                useClass: GrpcExceptionFilter,
            },
        ];

        // Explicitly type the controllers array to fix type error
        const controllers: Type<any>[] = [];
        const imports = [DiscoveryModule];

        // Add dashboard if enabled
        if (options.dashboard?.enable !== false) {
            this.addDashboardProviders(providers, options.dashboard);
            controllers.push(GrpcDashboardController);
        }

        return {
            module: GrpcModule,
            imports,
            providers,
            controllers,
            exports: [GrpcClientFactory, TypeGeneratorService, GRPC_LOGGER],
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
            {
                provide: APP_FILTER,
                useClass: GrpcExceptionFilter,
            },
        ];

        // We need to set up dashboard dynamically - explicitly type controllers array
        const controllers: Type<any>[] = [];

        // Add dashboard provider configuration - will be configured once options are resolved
        providers.push({
            provide: 'SETUP_DASHBOARD',
            useFactory: (grpcOptions: GrpcOptions) => {
                // Only add dashboard if enabled
                if (grpcOptions.dashboard?.enable !== false) {
                    // Add dashboard providers
                    this.addDashboardProviders(providers, grpcOptions.dashboard);
                    controllers.push(GrpcDashboardController);
                }
                return true;
            },
            inject: [GRPC_OPTIONS],
        });

        return {
            module: GrpcModule,
            imports: [DiscoveryModule, ...(options.imports || [])],
            providers,
            controllers,
            exports: [GrpcClientFactory, TypeGeneratorService, GRPC_LOGGER],
        };
    }

    /**
     * Add dashboard providers
     * @param providers The providers array to add to
     * @param options Dashboard options
     */
    private static addDashboardProviders(
        providers: Provider[],
        options?: GrpcDashboardOptions,
    ): void {
        const dashboardOptions = this.getDashboardOptions(options);

        // Add dashboard options provider
        providers.push({
            provide: 'DASHBOARD_OPTIONS',
            useValue: dashboardOptions,
        });

        // Add dashboard service and gateway
        providers.push(GrpcDashboardService);
        providers.push(GrpcDashboardGateway);
    }

    /**
     * Get dashboard options with defaults
     * @param options User-provided dashboard options
     * @returns Complete dashboard options with defaults
     */
    private static getDashboardOptions(
        options?: GrpcDashboardOptions,
    ): Required<GrpcDashboardOptions> {
        return {
            enable: options?.enable ?? true,
            apiPrefix: options?.apiPrefix ?? 'grpc-dashboard/api',
            maxLogs: options?.maxLogs ?? 1000,
            cors: options?.cors ?? { origin: '*' },
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
