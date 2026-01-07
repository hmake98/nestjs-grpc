import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

import { GRPC_CONTROLLER_METADATA, GRPC_METHOD_METADATA } from '../constants';
import { ControllerMetadata } from '../interfaces';
import { GrpcLogger } from '../utils/logger';

import { GrpcRegistryService } from './grpc-registry.service';

/**
 * Service responsible for automatically discovering and registering gRPC controllers.
 * Scans the application for controllers decorated with @GrpcController and
 * registers them with the gRPC provider service.
 */
@Injectable()
export class GrpcControllerDiscoveryService implements OnModuleInit {
    private readonly logger = new GrpcLogger({ context: 'GrpcControllerDiscovery' });

    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly metadataScanner: MetadataScanner,
        private readonly reflector: Reflector,
        private readonly registryService: GrpcRegistryService,
    ) {}

    /**
     * Lifecycle hook called after module initialization.
     * Discovers and registers all gRPC controllers.
     */
    onModuleInit(): void {
        this.logger.log('Starting gRPC controller discovery');
        this.discoverAndRegisterControllers();
    }

    /**
     * Discovers all gRPC controllers and registers them with the provider service
     */
    private discoverAndRegisterControllers(): void {
        this.logger.debug('Discovering gRPC controllers');

        const controllers = this.discoveryService.getControllers();
        this.logger.debug(`Found ${controllers.length} controllers to check`);

        for (const controllerWrapper of controllers) {
            // Get the actual controller instance from the wrapper
            const controller = controllerWrapper.instance ?? controllerWrapper;
            const controllerName = controller.constructor.name;

            this.logger.debug(`Checking controller: ${controllerName}`);

            // Check if it's a gRPC controller using the reflector
            const grpcMetadata = this.reflector.get(
                GRPC_CONTROLLER_METADATA,
                controller.constructor,
            );

            if (!grpcMetadata) {
                this.logger.debug(`Skipping regular HTTP controller: ${controllerName}`);
                continue;
            }

            // Check if it's a provider (not a controller)
            const isProvider = this.reflector.get('__isProvider__', controller.constructor);
            if (isProvider) {
                this.logger.debug(`Skipping non-controller provider: ${controllerName}`);
                continue;
            }

            this.logger.debug(`Found gRPC controller: ${controllerName}`);
            try {
                this.registerController(controller, grpcMetadata);
            } catch (error) {
                this.logger.error(`Failed to register controller ${controllerName}`, error);
            }
        }
    }

    /**
     * Registers a single gRPC controller with the registry service
     */
    private registerController(instance: any, controllerMetadata: any): void {
        try {
            const serviceName = controllerMetadata.serviceName;

            if (!serviceName) {
                this.logger.warn('Controller missing service name, skipping registration');
                return;
            }

            this.logger.debug(`Discovering methods for controller: ${serviceName}`);

            // Extract method metadata
            const methods = new Map<string, any>();
            const prototype = Object.getPrototypeOf(instance);

            // Get all method names from prototype
            const methodNames = Object.getOwnPropertyNames(prototype).filter(
                name => name !== 'constructor' && typeof prototype[name] === 'function',
            );

            this.logger.debug(`Method names to check: ${methodNames.join(', ')}`);

            for (const methodName of methodNames) {
                this.logger.debug(`Checking method: ${methodName}`);

                try {
                    // Try to get metadata from the prototype method using reflector
                    let methodMetadata = this.reflector.get(
                        GRPC_METHOD_METADATA,
                        prototype[methodName],
                    );

                    if (methodMetadata) {
                        const grpcMethodName = methodMetadata.methodName ?? methodName;
                        methods.set(grpcMethodName, methodMetadata);
                        this.logger.debug(`Found gRPC method: ${serviceName}.${grpcMethodName}`);
                        continue;
                    }

                    // Try alternative approach - check if method has metadata
                    methodMetadata = Reflect.getMetadata(
                        GRPC_METHOD_METADATA,
                        prototype,
                        methodName,
                    );
                    if (methodMetadata) {
                        const grpcMethodName = methodMetadata.methodName ?? methodName;
                        methods.set(grpcMethodName, methodMetadata);
                        this.logger.debug(
                            `Found gRPC method (alt): ${serviceName}.${grpcMethodName}`,
                        );
                        continue;
                    }

                    // If no metadata, try to infer gRPC method name by converting camelCase to PascalCase
                    const inferredMethodName =
                        methodName.charAt(0).toUpperCase() + methodName.slice(1);
                    methods.set(inferredMethodName, {
                        methodName: inferredMethodName,
                        originalMethodName: methodName,
                    });
                    this.logger.debug(
                        `Inferred gRPC method: ${serviceName}.${inferredMethodName} from ${methodName}`,
                    );
                } catch (error) {
                    this.logger.debug(`Error checking method ${methodName}: ${error.message}`);
                }
            }

            if (methods.size === 0) {
                this.logger.warn(`No gRPC methods found for controller: ${serviceName}`);
                return;
            }

            // Log all discovered methods
            this.logger.debug(`Discovered ${methods.size} methods for ${serviceName}`);

            // Create controller metadata
            const metadata: ControllerMetadata = {
                serviceName,
                package: controllerMetadata.package ?? 'default',
                methods,
            };

            // Register with registry service
            this.registryService.registerController(serviceName, instance, metadata);

            this.logger.log(`Successfully registered gRPC controller: ${serviceName}`);
        } catch (error) {
            this.logger.error(`Failed to register controller`, error);
            throw error;
        }
    }
}
