import { GrpcDashboardOptions } from 'src/interfaces';

export interface GrpcServiceInfo {
    id: string;
    name: string;
    methods: string[];
    package: string;
    status: 'active' | 'inactive';
    url: string;
    lastActivity?: Date;
}

export interface GrpcConnection {
    id: string;
    clientId: string;
    service: string;
    url: string;
    status: 'connected' | 'disconnected' | 'error';
    established: Date;
    lastActivity: Date;
}

export interface LogEntry {
    id: string;
    timestamp: Date;
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    message: string;
    context: string;
    service?: string;
    method?: string;
}

export interface StatsData {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
}

export interface GrpcDashboardAsyncOptions {
    imports?: any[];
    useFactory: (...args: any[]) => Promise<GrpcDashboardOptions> | GrpcDashboardOptions;
    inject?: any[];
}
