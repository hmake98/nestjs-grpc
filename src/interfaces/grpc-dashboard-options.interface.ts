/**
 * Dashboard configuration options
 */
export interface GrpcDashboardOptions {
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
