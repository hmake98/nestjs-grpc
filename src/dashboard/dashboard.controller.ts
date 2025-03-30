import { Controller, Get, Query, Inject, Param } from '@nestjs/common';
import { GrpcDashboardService } from './dashboard.service';

@Controller()
export class GrpcDashboardController {
    constructor(
        private readonly dashboardService: GrpcDashboardService,
        @Inject('DASHBOARD_OPTIONS') private readonly options: { apiPrefix: string },
    ) {}

    // Update the controller prefix dynamically based on the module options
    onModuleInit() {
        // This is a workaround since we can't use dynamic prefixes directly in the @Controller decorator
        Reflect.defineMetadata('path', this.options.apiPrefix, GrpcDashboardController);
    }

    /**
     * Get all discovered gRPC services
     */
    @Get('services')
    getServices() {
        return this.dashboardService.getServices();
    }

    /**
     * Get a specific service by ID
     */
    @Get('services/:id')
    getService(@Param('id') id: string) {
        const service = this.dashboardService.getServices().find(s => s.id === id);
        if (!service) {
            return { error: 'Service not found' };
        }
        return service;
    }

    /**
     * Get all active connections
     */
    @Get('connections')
    getConnections() {
        return this.dashboardService.getConnections();
    }

    /**
     * Get logs with optional filtering
     */
    @Get('logs')
    getLogs(
        @Query('levels') levels?: string,
        @Query('service') service?: string,
        @Query('limit') limit?: string,
    ) {
        const logLevels = levels ? levels.split(',') : undefined;
        const logLimit = limit ? parseInt(limit, 10) : 100;

        return this.dashboardService.getLogs(logLevels, service, logLimit);
    }

    /**
     * Get request statistics
     */
    @Get('stats')
    getStats() {
        return this.dashboardService.getStats();
    }

    /**
     * Get basic system info for the dashboard
     */
    @Get('info')
    getInfo() {
        return {
            version: process.env.npm_package_version || '1.1.0',
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform,
            servicesCount: this.dashboardService.getServices().length,
            connectionsCount: this.dashboardService.getConnections().length,
            logsCount: this.dashboardService.getLogs().length,
        };
    }
}
