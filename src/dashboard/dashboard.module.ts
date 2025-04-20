import { DynamicModule, Module, Provider, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ModulesContainer } from '@nestjs/core';
import { GrpcDashboardController } from './dashboard.controller';
import { GrpcDashboardService } from './dashboard.service';
import { GrpcDashboardGateway } from './dashboard.gateway';
import { DashboardPrefixMiddleware } from './dashboard.middleware';
import { GrpcDashboardOptions } from '../interfaces/grpc-dashboard-options.interface';
import { GRPC_LOGGER, GRPC_OPTIONS } from '../constants';
import { DASHBOARD_OPTIONS } from './dashboard.constants';
import { GrpcLogger } from '../interfaces/logger.interface';
import { GrpcOptions } from '../interfaces/grpc-options.interface';
import { GrpcDashboardAsyncOptions } from './dashboard.interface';

/**
 * Dashboard module for monitoring gRPC services
 * This module provides:
 * - REST API endpoints for querying services, connections and logs
 * - WebSocket gateway for real-time updates
 * - Service discovery and monitoring
 */
@Module({})
export class GrpcDashboardModule implements NestModule {
    /**
     * Register the dashboard module with static options
     * @param options The dashboard options
     * @returns The dynamic module
     */
    static forRoot(options?: GrpcDashboardOptions): DynamicModule {
        const dashboardOptions = this.getDashboardOptions(options);

        // Don't initialize controllers and services if explicitly disabled
        if (dashboardOptions.enable === false) {
            return {
                module: GrpcDashboardModule,
                providers: [
                    {
                        provide: DASHBOARD_OPTIONS,
                        useValue: dashboardOptions,
                    },
                ],
            };
        }

        const routePath = dashboardOptions.apiPrefix.startsWith('/')
            ? dashboardOptions.apiPrefix
            : `/${dashboardOptions.apiPrefix}`;

        return {
            module: GrpcDashboardModule,
            imports: [
                RouterModule.register([
                    {
                        path: routePath,
                        module: GrpcDashboardModule,
                    },
                ]),
            ],
            providers: [
                {
                    provide: DASHBOARD_OPTIONS,
                    useValue: dashboardOptions,
                },
                GrpcDashboardService,
                GrpcDashboardGateway,
            ],
            controllers: [GrpcDashboardController],
            exports: [GrpcDashboardService],
        };
    }

    /**
     * Register the dashboard module with async options
     * @param options The async options
     * @returns The dynamic module
     */
    static forRootAsync(options: GrpcDashboardAsyncOptions): DynamicModule {
        // Common providers for both enabled and disabled states
        const optionsProvider = {
            provide: DASHBOARD_OPTIONS,
            useFactory: options.useFactory,
            inject: options.inject || [],
        };

        const dashboardEnabledProvider = {
            provide: 'DASHBOARD_ENABLED',
            useFactory: async (...args: any[]) => {
                const dashboardOptions = await options.useFactory(...args);
                return dashboardOptions?.enable !== false;
            },
            inject: options.inject || [],
        };

        // Return minimal module if dashboard is disabled
        return {
            module: GrpcDashboardModule,
            imports: [...this.createRouterModule(optionsProvider), ...(options.imports || [])],
            providers: [
                optionsProvider,
                dashboardEnabledProvider,
                {
                    provide: GrpcDashboardService,
                    useFactory: (
                        dashboardEnabled: boolean,
                        logger: GrpcLogger,
                        grpcOptions: GrpcOptions,
                        dashboardOptions: Required<GrpcDashboardOptions>,
                        modulesContainer: ModulesContainer,
                    ) => {
                        if (!dashboardEnabled) {
                            // Return a mock service when dashboard is disabled
                            return {
                                getServices: () => [],
                                getConnections: () => [],
                                getLogs: () => [],
                                getStats: () => ({
                                    totalRequests: 0,
                                    successfulRequests: 0,
                                    failedRequests: 0,
                                    avgResponseTime: 0,
                                }),
                                onLog: () => () => {},
                                onConnection: () => () => {},
                                onStats: () => () => {},
                            };
                        }
                        // Create real service with proper parameters
                        return new GrpcDashboardService(
                            logger,
                            grpcOptions,
                            dashboardOptions,
                            modulesContainer,
                        );
                    },
                    inject: [
                        'DASHBOARD_ENABLED',
                        GRPC_LOGGER,
                        GRPC_OPTIONS,
                        DASHBOARD_OPTIONS,
                        ModulesContainer,
                    ],
                },
                GrpcDashboardGateway,
            ],
            controllers: [GrpcDashboardController],
            exports: [GrpcDashboardService],
        };
    }

    /**
     * Create the router module for the dashboard
     * @param optionsProvider The options provider
     * @returns An array of modules to import
     */
    private static createRouterModule(optionsProvider: Provider): any[] {
        // We need to return an empty array or the RouterModule
        // This avoids the TypeScript error by not returning a DynamicModule directly
        return [RouterModule.register([])];
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
     * Configure middleware to handle API prefix routing
     */
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(DashboardPrefixMiddleware).forRoutes(GrpcDashboardController);
    }
}
