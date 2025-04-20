import { DynamicModule, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ModulesContainer } from '@nestjs/core';
import { GrpcDashboardController } from './dashboard.controller';
import { GrpcDashboardService } from './dashboard.service';
import { GrpcDashboardGateway } from './dashboard.gateway';
import { DashboardPrefixMiddleware } from './dashboard.middleware';
import { GrpcDashboardOptions } from '../interfaces/grpc-dashboard-options.interface';
import { GrpcOptions } from '../interfaces/grpc-options.interface';
import { GRPC_LOGGER, GRPC_OPTIONS } from '../constants';
import { DASHBOARD_OPTIONS } from './dashboard.constants';
import { GrpcLogger } from '../interfaces/logger.interface';
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
                exports: [DASHBOARD_OPTIONS],
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
                // This will attempt to re-use GRPC_OPTIONS from parent module scope
                // But will fail if GRPC_OPTIONS is not in the parent scope
                {
                    provide: GRPC_OPTIONS,
                    useExisting: GRPC_OPTIONS,
                },
                GrpcDashboardService,
                GrpcDashboardGateway,
            ],
            controllers: [GrpcDashboardController],
            exports: [GrpcDashboardService, DASHBOARD_OPTIONS],
        };
    }

    /**
     * Register the dashboard module with gRPC options and dashboard options
     * This method should be called from the GrpcModule to ensure proper dependency injection
     * @param grpcOptions The gRPC options
     * @param dashboardOptions The dashboard options
     * @returns The dynamic module
     */
    static forRootWithOptions(
        grpcOptions: GrpcOptions,
        dashboardOptions?: GrpcDashboardOptions,
    ): DynamicModule {
        const completeOptions = this.getDashboardOptions(dashboardOptions);

        // Don't initialize controllers and services if explicitly disabled
        if (completeOptions.enable === false) {
            return {
                module: GrpcDashboardModule,
                providers: [
                    {
                        provide: DASHBOARD_OPTIONS,
                        useValue: completeOptions,
                    },
                ],
                exports: [DASHBOARD_OPTIONS],
            };
        }

        const routePath = completeOptions.apiPrefix.startsWith('/')
            ? completeOptions.apiPrefix
            : `/${completeOptions.apiPrefix}`;

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
                    useValue: completeOptions,
                },
                // Explicitly provide GRPC_OPTIONS with the value from the parent module
                {
                    provide: GRPC_OPTIONS,
                    useValue: grpcOptions,
                },
                GrpcDashboardService,
                GrpcDashboardGateway,
            ],
            controllers: [GrpcDashboardController],
            exports: [GrpcDashboardService, DASHBOARD_OPTIONS],
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

        const routePath = {
            provide: 'DASHBOARD_ROUTE_PATH',
            useFactory: async (...args: any[]) => {
                const dashboardOptions = await options.useFactory(...args);
                const apiPrefix = dashboardOptions?.apiPrefix || 'grpc-dashboard/api';
                return apiPrefix.startsWith('/') ? apiPrefix : `/${apiPrefix}`;
            },
            inject: options.inject || [],
        };

        // Create router module with the dynamic path
        const routerImport = RouterModule.register([]);

        return {
            module: GrpcDashboardModule,
            imports: [routerImport, ...(options.imports || [])],
            providers: [
                optionsProvider,
                dashboardEnabledProvider,
                routePath,
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
            exports: [GrpcDashboardService, DASHBOARD_OPTIONS],
        };
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
