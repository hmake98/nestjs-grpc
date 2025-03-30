import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { GRPC_OPTIONS, GRPC_LOGGER } from '../constants';
import { GrpcOptions } from '../interfaces/grpc-options.interface';
import { GrpcLogger } from '../interfaces/logger.interface';
import { loadProto, getServiceByName } from '../utils/proto-utils';

@Injectable()
export class ProtoLoaderService {
    constructor(
        @Inject(GRPC_OPTIONS) private readonly options: GrpcOptions,
        @Inject(GRPC_LOGGER) private readonly logger: GrpcLogger,
    ) {}

    /**
     * Loads the proto file and returns the package definition
     * @returns The package definition
     */
    async load(): Promise<any> {
        const { protoPath, package: packageName, loaderOptions } = this.options;

        this.logger.info(`Loading proto file: ${protoPath}`, 'ProtoLoaderService');

        try {
            const packageDefinition = await loadProto(protoPath, loaderOptions);
            const services = this.getServiceByPackageName(packageDefinition, packageName);

            this.logger.debug(
                `Successfully loaded proto file with package: ${packageName}`,
                'ProtoLoaderService',
            );

            return services;
        } catch (error) {
            this.logger.error(
                `Failed to load proto file: ${error.message}`,
                'ProtoLoaderService',
                error.stack,
            );
            throw new Error(`Failed to load proto file: ${error.message}`);
        }
    }

    /**
     * Loads a specific service from the proto file
     * @param serviceName The service name
     * @returns The service definition
     */
    async loadService(serviceName: string): Promise<any> {
        const { protoPath, package: packageName, loaderOptions } = this.options;

        this.logger.info(
            `Loading service ${serviceName} from proto file: ${protoPath}`,
            'ProtoLoaderService',
        );

        try {
            const packageDefinition = await loadProto(protoPath, loaderOptions);
            const service = getServiceByName(packageDefinition, packageName, serviceName);

            this.logger.debug(`Successfully loaded service: ${serviceName}`, 'ProtoLoaderService');

            return service;
        } catch (error) {
            this.logger.error(
                `Failed to load service ${serviceName}: ${error.message}`,
                'ProtoLoaderService',
                error.stack,
            );
            throw new Error(`Failed to load service ${serviceName}: ${error.message}`);
        }
    }

    /**
     * Gets a service by package name
     * @param proto The proto definition
     * @param packageName The package name
     * @returns The package
     */
    private getServiceByPackageName(proto: any, packageName: string): any {
        if (!packageName) {
            this.logger.verbose(
                'No package name provided, returning full proto definition',
                'ProtoLoaderService',
            );
            return proto;
        }

        try {
            this.logger.verbose(
                `Finding package ${packageName} in proto definition`,
                'ProtoLoaderService',
            );

            return packageName.split('.').reduce((acc, part) => {
                if (!acc[part]) {
                    this.logger.error(`Package part ${part} not found`, 'ProtoLoaderService');
                    throw new Error(`Package part ${part} not found`);
                }
                return acc[part];
            }, proto);
        } catch (error) {
            this.logger.error(
                `Failed to find package ${packageName}: ${error.message}`,
                'ProtoLoaderService',
            );
            throw new Error(`Failed to find package ${packageName}: ${error.message}`);
        }
    }
}
