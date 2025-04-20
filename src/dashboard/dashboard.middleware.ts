import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { GrpcDashboardOptions } from '../interfaces/grpc-dashboard-options.interface';
import { DASHBOARD_OPTIONS } from './dashboard.constants';

/**
 * Middleware to handle API prefix for dashboard routes
 * This solves the issue of dynamic controller prefixes
 */
@Injectable()
export class DashboardPrefixMiddleware implements NestMiddleware {
    constructor(
        @Inject(DASHBOARD_OPTIONS) private readonly options: Required<GrpcDashboardOptions>,
    ) {}

    use(req: Request, res: Response, next: NextFunction) {
        // Extract the API prefix from the options
        const prefix = this.options.apiPrefix;

        // Remove the prefix from the URL for internal routing
        if (req.url.startsWith(`/${prefix}`)) {
            req.url = req.url.substring(prefix.length + 1);
        }

        next();
    }
}
