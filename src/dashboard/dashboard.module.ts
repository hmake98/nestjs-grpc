import { DynamicModule, Module, forwardRef, Provider } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardGateway } from './dashboard.gateway';
import { GRPC_OPTIONS } from '../constants';
import { GrpcOptions } from '../interfaces/grpc-options.interface';
import { GrpcModule } from '../grpc.module';

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

    /**
     * gRPC options (if not using GrpcModule)
     */
    grpcOptions?: GrpcOptions;
}

@Module({})
export class DashboardModule {
    /**
     * Register the dashboard module
     * @param options Dashboard module options
     * @returns Dynamic module
     */
    static register(options?: DashboardModuleOptions): DynamicModule {
        const finalOptions: Required<Omit<DashboardModuleOptions, 'grpcOptions'>> = {
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

        // Prepare providers
        const providers: Provider[] = [
            {
                provide: 'DASHBOARD_OPTIONS',
                useValue: finalOptions,
            },
        ];

        // If grpcOptions is provided, add it as a provider
        if (options?.grpcOptions) {
            providers.push({
                provide: GRPC_OPTIONS,
                useValue: options.grpcOptions,
            });
        }

        // Add service and gateway
        providers.push(DashboardService);
        providers.push(DashboardGateway);

        return {
            module: DashboardModule,
            imports: [
                // This creates a circular import but works in NestJS because of forwardRef
                forwardRef(() => GrpcModule),
            ],
            providers,
            controllers: [DashboardController],
            exports: [DashboardService],
        };
    }
}
