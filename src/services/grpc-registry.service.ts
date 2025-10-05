import { Injectable, OnModuleInit } from '@nestjs/common';

import { PROVIDER_READY_MAX_ATTEMPTS, PROVIDER_READY_CHECK_DELAY } from '../constants';
import { ControllerMetadata } from '../interfaces';
import { GrpcLogger } from '../utils/logger';

import { GrpcProviderService } from './grpc-provider.service';

/**
 * Service responsible for managing gRPC component registrations.
 * Acts as a central registry for controllers, services, and their metadata.
 *
 * Features:
 * - Queues controller registrations until server is ready
 * - Handles registration errors gracefully
 * - Provides registration status tracking
 * - Supports dynamic controller registration
 * - Manages service discovery and metadata
 */
@Injectable()
export class GrpcRegistryService implements OnModuleInit {
    private readonly logger = new GrpcLogger({ context: 'GrpcRegistry' });
    private readonly pendingRegistrations = new Map<
        string,
        { instance: any; metadata: ControllerMetadata }
    >();
    private isProcessingRegistrations = false;

    constructor(private readonly providerService: GrpcProviderService) {}

    /**
     * Lifecycle hook called after module initialization.
     * Processes any pending controller registrations.
     */
    onModuleInit(): void {
        this.logger.lifecycle('Processing pending controller registrations');
        this.processPendingRegistrations();
    }

    /**
     * Registers a controller instance with its metadata.
     * If the server is not ready, queues the registration for later processing.
     */
    registerController(serviceName: string, instance: any, metadata: ControllerMetadata): void {
        try {
            this.logger.debug(`Registering controller: ${serviceName}`);

            // Store controller instance
            this.pendingRegistrations.set(serviceName, { instance, metadata });

            // Always register with provider service - it will handle pending state
            this.providerService.registerController(serviceName, instance, metadata);
        } catch (error) {
            this.logger.error(`Failed to register controller ${serviceName}`, error);
            throw error;
        }
    }

    /**
     * Gets all registered controllers
     */
    getRegisteredControllers(): Map<string, { instance: any; metadata: ControllerMetadata }> {
        return new Map(this.pendingRegistrations);
    }

    /**
     * Checks if a controller is registered
     */
    isControllerRegistered(serviceName: string): boolean {
        return this.pendingRegistrations.has(serviceName);
    }

    /**
     * Processes all pending controller registrations
     */
    private processPendingRegistrations(): void {
        if (this.isProcessingRegistrations || this.pendingRegistrations.size === 0) {
            return;
        }

        this.isProcessingRegistrations = true;

        try {
            const registrations = Array.from(this.pendingRegistrations.entries());
            let successCount = 0;
            let errorCount = 0;

            for (const [serviceName, { instance, metadata }] of registrations) {
                try {
                    this.providerService.registerController(serviceName, instance, metadata);
                    successCount++;
                } catch (error) {
                    this.logger.error(
                        `Failed to register pending controller ${serviceName}`,
                        error,
                    );
                    errorCount++;
                }
            }

            this.logger.lifecycle('Pending registrations processed', {
                total: registrations.length,
                successful: successCount,
                failed: errorCount,
            });

            // Clear processed registrations
            this.pendingRegistrations.clear();
        } finally {
            this.isProcessingRegistrations = false;
        }
    }

    /**
     * Waits for the provider service to be ready
     */
    private async waitForProviderReady(): Promise<void> {
        let attempts = 0;

        while (attempts < PROVIDER_READY_MAX_ATTEMPTS) {
            if (this.providerService.isServerRunning()) {
                return;
            }

            this.logger.debug(`Provider not ready, attempt ${attempts + 1}/${PROVIDER_READY_MAX_ATTEMPTS}`);
            await new Promise(resolve => setTimeout(resolve, PROVIDER_READY_CHECK_DELAY));
            attempts++;
        }

        this.logger.warn('Provider service not ready after maximum attempts, proceeding anyway');
    }
}
