import { Injectable, OnModuleInit } from '@nestjs/common';

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
    async onModuleInit(): Promise<void> {
        this.logger.lifecycle('Processing pending controller registrations');
        await this.processPendingRegistrations();
    }

    /**
     * Registers a controller instance with its metadata.
     * If the server is not ready, queues the registration for later processing.
     */
    async registerController(
        serviceName: string,
        instance: any,
        metadata: ControllerMetadata,
    ): Promise<void> {
        try {
            this.logger.debug(`Registering controller: ${serviceName}`);

            // Store controller instance
            this.pendingRegistrations.set(serviceName, { instance, metadata });

            // Always register with provider service - it will handle pending state
            await this.providerService.registerController(serviceName, instance, metadata);
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
    private async processPendingRegistrations(): Promise<void> {
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
                    await this.providerService.registerController(serviceName, instance, metadata);
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
        } finally {
            this.isProcessingRegistrations = false;
        }
    }

    /**
     * Waits for the provider service to be ready
     */
    private async waitForProviderReady(): Promise<void> {
        let attempts = 0;
        const maxAttempts = 10;
        const delay = 100; // 100ms between attempts

        while (attempts < maxAttempts) {
            if (this.providerService.isServerRunning()) {
                return;
            }

            this.logger.debug(`Provider not ready, attempt ${attempts + 1}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempts++;
        }

        this.logger.warn('Provider service not ready after maximum attempts, proceeding anyway');
    }
}
