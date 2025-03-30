import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
    GRPC_LOGGER,
    GRPC_OPTIONS,
    GRPC_SERVICE_METADATA,
    GRPC_METHOD_METADATA,
} from '../constants';
import { GrpcLogger } from '../interfaces/logger.interface';
import { GrpcOptions } from '../interfaces/grpc-options.interface';

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

@Injectable()
export class GrpcDashboardService implements OnModuleInit {
    private services: GrpcServiceInfo[] = [];
    private connections: GrpcConnection[] = [];
    private logs: LogEntry[] = [];
    private stats: StatsData = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
    };

    private maxLogs: number;
    private logListeners: Array<(log: LogEntry) => void> = [];
    private connectionListeners: Array<(connection: GrpcConnection) => void> = [];
    private statsListeners: Array<(stats: StatsData) => void> = [];

    constructor(
        @Inject(GRPC_LOGGER) private readonly logger: GrpcLogger,
        @Inject(GRPC_OPTIONS) private readonly options: GrpcOptions,
        @Inject('DASHBOARD_OPTIONS') private readonly dashboardOptions: { maxLogs: number },
        private readonly modulesContainer: ModulesContainer,
    ) {
        this.maxLogs = dashboardOptions.maxLogs;
    }

    onModuleInit() {
        // Discover gRPC services
        this.discoverGrpcServices();

        // Set up logger interception
        this.hookLogger();

        this.logger.info('gRPC Dashboard service initialized', 'DashboardService');
    }

    /**
     * Gets all discovered gRPC services
     */
    getServices(): GrpcServiceInfo[] {
        return this.services;
    }

    /**
     * Gets active connections
     */
    getConnections(): GrpcConnection[] {
        return this.connections;
    }

    /**
     * Gets logs with optional filtering
     */
    getLogs(levels?: string[], service?: string, limit: number = 100): LogEntry[] {
        let filteredLogs = [...this.logs];

        // Filter by log level if specified
        if (levels && levels.length > 0) {
            filteredLogs = filteredLogs.filter(log => levels.includes(log.level));
        }

        // Filter by service if specified
        if (service) {
            filteredLogs = filteredLogs.filter(
                log => log.service === service || log.context === service,
            );
        }

        // Limit the number of logs returned
        return filteredLogs.slice(0, limit);
    }

    /**
     * Gets request statistics
     */
    getStats(): StatsData {
        return this.stats;
    }

    /**
     * Adds a log entry
     */
    addLog(log: LogEntry): void {
        this.logs.unshift(log);

        // Limit number of logs
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        // Notify listeners
        this.logListeners.forEach(listener => listener(log));
    }

    /**
     * Registers a new connection
     */
    addConnection(connection: GrpcConnection): void {
        // Check if connection already exists
        const existingIndex = this.connections.findIndex(c => c.id === connection.id);

        if (existingIndex >= 0) {
            // Update existing connection
            this.connections[existingIndex] = connection;
        } else {
            // Add new connection
            this.connections.push(connection);
        }

        // Notify listeners
        this.connectionListeners.forEach(listener => listener(connection));
    }

    /**
     * Updates a connection's status
     */
    updateConnectionStatus(id: string, status: 'connected' | 'disconnected' | 'error'): void {
        const connection = this.connections.find(c => c.id === id);

        if (connection) {
            connection.status = status;
            connection.lastActivity = new Date();

            // Notify listeners
            this.connectionListeners.forEach(listener => listener(connection));
        }
    }

    /**
     * Records a request for statistics
     */
    recordRequest(success: boolean, responseTime: number): void {
        this.stats.totalRequests++;

        if (success) {
            this.stats.successfulRequests++;
        } else {
            this.stats.failedRequests++;
        }

        // Update average response time
        const oldTotal = this.stats.avgResponseTime * (this.stats.totalRequests - 1);
        this.stats.avgResponseTime = (oldTotal + responseTime) / this.stats.totalRequests;

        // Notify listeners
        this.statsListeners.forEach(listener => listener(this.stats));
    }

    /**
     * Registers a log listener
     * @returns Unsubscribe function
     */
    onLog(callback: (log: LogEntry) => void): () => void {
        this.logListeners.push(callback);
        return () => {
            this.logListeners = this.logListeners.filter(listener => listener !== callback);
        };
    }

    /**
     * Registers a connection listener
     * @returns Unsubscribe function
     */
    onConnection(callback: (connection: GrpcConnection) => void): () => void {
        this.connectionListeners.push(callback);
        return () => {
            this.connectionListeners = this.connectionListeners.filter(
                listener => listener !== callback,
            );
        };
    }

    /**
     * Registers a stats listener
     * @returns Unsubscribe function
     */
    onStats(callback: (stats: StatsData) => void): () => void {
        this.statsListeners.push(callback);
        return () => {
            this.statsListeners = this.statsListeners.filter(listener => listener !== callback);
        };
    }

    /**
     * Discovers gRPC services in the application
     */
    private discoverGrpcServices(): void {
        const modules = [...this.modulesContainer.values()];
        const controllers: InstanceWrapper[] = modules
            .filter(module => module.controllers.size > 0)
            .flatMap(module => [...module.controllers.values()]);

        const services: GrpcServiceInfo[] = [];
        let id = 1;

        controllers.forEach(wrapper => {
            const { instance, metatype } = wrapper;
            if (!instance || !metatype) return;

            // Check if this is a gRPC service
            const metadata = Reflect.getMetadata(GRPC_SERVICE_METADATA, metatype);
            if (!metadata) return;

            const methods = this.getServiceMethods(instance);

            services.push({
                id: `service-${id++}`,
                name: metadata.serviceName || metatype.name,
                methods,
                package: metadata.package || this.options.package || 'unknown',
                status: 'active',
                url: metadata.url || this.options.url || 'unknown',
                lastActivity: new Date(),
            });
        });

        this.services = services;
        this.logger.debug(`Discovered ${services.length} gRPC services`, 'DashboardService');
    }

    /**
     * Gets methods from a service instance
     */
    private getServiceMethods(instance: any): string[] {
        const methods: string[] = [];

        // Get all methods from the prototype
        const prototype = Object.getPrototypeOf(instance);
        if (!prototype) return methods;

        // Look for methods with gRPC method metadata
        Object.getOwnPropertyNames(prototype)
            .filter(prop => typeof instance[prop] === 'function' && prop !== 'constructor')
            .forEach(methodName => {
                const metadata = Reflect.getMetadata(GRPC_METHOD_METADATA, instance, methodName);
                if (metadata) {
                    methods.push(metadata.methodName || methodName);
                }
            });

        return methods;
    }

    /**
     * Hooks into the logger to capture logs
     */
    private hookLogger(): void {
        // We'll create a custom logger that both delegates to the original
        // and captures logs for the dashboard
        const originalLogger = this.logger;

        // Override logger methods to capture logs
        const createLogMethod = (level: 'error' | 'warn' | 'info' | 'debug' | 'verbose') => {
            return function (
                this: GrpcDashboardService,
                message: string,
                context?: string,
                trace?: string,
            ) {
                // Call original method
                (originalLogger[level] as any)(message, context, trace);

                // Capture log
                const logEntry: LogEntry = {
                    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    timestamp: new Date(),
                    level,
                    message,
                    context: context || 'unknown',
                };

                // Add service/method if we can detect it from context
                if (
                    context &&
                    this.services.some(s => s.name === context || context.includes(s.name))
                ) {
                    logEntry.service = context;
                }

                this.addLog(logEntry);
            }.bind(this);
        };

        // Replace the gRPC logger with one that captures logs
        const interceptedLogger: GrpcLogger = {
            error: createLogMethod('error'),
            warn: createLogMethod('warn'),
            info: createLogMethod('info'),
            debug: createLogMethod('debug'),
            verbose: createLogMethod('verbose'),
            setLogLevel: originalLogger.setLogLevel.bind(originalLogger),
        };

        // Replace the logger in the module
        (this as any).logger = interceptedLogger;
    }
}
