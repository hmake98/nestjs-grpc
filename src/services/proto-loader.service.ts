import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { GRPC_OPTIONS } from '../constants';
import { GrpcOptions } from '../interfaces/grpc-options.interface';
import { loadProto, getServiceByName } from '../utils/proto-utils';

@Injectable()
export class ProtoLoaderService {
    constructor(@Inject(GRPC_OPTIONS) private readonly options: GrpcOptions) {}

    /**
     * Loads the proto file and returns the package definition
     * @returns The package definition
     */
    async load(): Promise<any> {
        const { protoPath, package: packageName, loaderOptions } = this.options;

        try {
            const packageDefinition = await loadProto(protoPath, loaderOptions);
            return this.getServiceByPackageName(packageDefinition, packageName);
        } catch (error) {
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

        try {
            const packageDefinition = await loadProto(protoPath, loaderOptions);
            return getServiceByName(packageDefinition, packageName, serviceName);
        } catch (error) {
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
            return proto;
        }

        try {
            return packageName.split('.').reduce((acc, part) => {
                if (!acc[part]) {
                    throw new Error(`Package part ${part} not found`);
                }
                return acc[part];
            }, proto);
        } catch (error) {
            throw new Error(`Failed to find package ${packageName}: ${error.message}`);
        }
    }
}
