import { DynamicModule, Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardGateway } from './dashboard.gateway';

export interface DashboardModuleOptions {
    /**
     * Enable or disable the dashboard API
     * @default true
     */
    enable?: boolean;

    /**
     * API endpoint prefix
     * @default 'grpc-dashboard/api'
     */
    apiPrefix?: string;

    /**
     * Maximum number of logs to keep in memory
     * @default 1000
     */
    maxLogs?: number;

    /**
     * CORS options for WebSocket
     * @default { origin: '*' }
     */
    cors?: { origin: string | string[] | boolean };
}

@Module({})
export class DashboardModule {
    /**
     * Register the dashboard module
     * @param options Dashboard module options
     * @returns Dynamic module
     */
    static register(options?: DashboardModuleOptions): DynamicModule {
        const finalOptions: Required<DashboardModuleOptions> = {
            enable: options?.enable ?? true,
            apiPrefix: options?.apiPrefix ?? 'grpc-dashboard/api',
            maxLogs: options?.maxLogs ?? 1000,
            cors: options?.cors ?? { origin: '*' },
        };

        // If dashboard is disabled, return empty module
        if (!finalOptions.enable) {
            return {
                module: DashboardModule,
            };
        }

        return {
            module: DashboardModule,
            providers: [
                {
                    provide: 'DASHBOARD_OPTIONS',
                    useValue: finalOptions,
                },
                DashboardService,
                DashboardGateway,
            ],
            controllers: [DashboardController],
            exports: [DashboardService],
        };
    }
}
