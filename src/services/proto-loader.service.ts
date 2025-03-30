import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
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
     * Loads the proto file(s) and returns the package definition
     * @returns The package definition
     */
    async load(): Promise<any> {
        const { protoPath, package: packageName, loaderOptions } = this.options;

        this.logger.info(`Loading proto files from: ${protoPath}`, 'ProtoLoaderService');

        try {
            // Check if protoPath is a directory or a glob pattern
            if (this.isDirectory(protoPath) || this.isGlobPattern(protoPath)) {
                // Find all proto files in the directory/pattern
                const protoFiles = await this.findProtoFiles(protoPath);

                if (protoFiles.length === 0) {
                    throw new Error(`No proto files found in ${protoPath}`);
                }

                this.logger.debug(`Found ${protoFiles.length} proto file(s)`, 'ProtoLoaderService');

                // Load all found proto files
                const services = {};
                for (const file of protoFiles) {
                    try {
                        this.logger.debug(`Loading proto file: ${file}`, 'ProtoLoaderService');
                        const packageDef = await loadProto(file, loaderOptions);
                        const fileServices = this.getServiceByPackageName(packageDef, packageName);

                        // Merge services from multiple files
                        Object.assign(services, fileServices);
                    } catch (fileError) {
                        this.logger.warn(
                            `Error loading proto file ${file}: ${fileError.message}`,
                            'ProtoLoaderService',
                        );
                    }
                }

                this.logger.debug(
                    `Successfully loaded proto files with package: ${packageName || 'all'}`,
                    'ProtoLoaderService',
                );

                return services;
            } else {
                // Direct file path
                const packageDefinition = await loadProto(protoPath, loaderOptions);
                const services = this.getServiceByPackageName(packageDefinition, packageName);

                this.logger.debug(
                    `Successfully loaded proto file with package: ${packageName || 'all'}`,
                    'ProtoLoaderService',
                );

                return services;
            }
        } catch (error) {
            this.logger.error(
                `Failed to load proto file(s): ${error.message}`,
                'ProtoLoaderService',
                error.stack,
            );
            throw new Error(`Failed to load proto file(s): ${error.message}`);
        }
    }

    /**
     * Loads a specific service from the proto file(s)
     * @param serviceName The service name
     * @returns The service definition
     */
    async loadService(serviceName: string): Promise<any> {
        const { protoPath, package: packageName, loaderOptions } = this.options;

        this.logger.info(
            `Loading service ${serviceName} from proto files in: ${protoPath}`,
            'ProtoLoaderService',
        );

        try {
            // Check if protoPath is a directory or a glob pattern
            if (this.isDirectory(protoPath) || this.isGlobPattern(protoPath)) {
                // Find all proto files in the directory/pattern
                const protoFiles = await this.findProtoFiles(protoPath);

                if (protoFiles.length === 0) {
                    throw new Error(`No proto files found in ${protoPath}`);
                }

                // Try to load service from each file until found
                for (const file of protoFiles) {
                    try {
                        const packageDef = await loadProto(file, loaderOptions);
                        const service = getServiceByName(packageDef, packageName, serviceName);

                        if (service) {
                            this.logger.debug(
                                `Successfully loaded service: ${serviceName} from ${file}`,
                                'ProtoLoaderService',
                            );
                            return service;
                        }
                    } catch {
                        // Continue to next file if service not found in this one
                    }
                }

                throw new Error(`Service ${serviceName} not found in any proto file`);
            } else {
                // Direct file path
                const packageDefinition = await loadProto(protoPath, loaderOptions);
                const service = getServiceByName(packageDefinition, packageName, serviceName);

                this.logger.debug(
                    `Successfully loaded service: ${serviceName}`,
                    'ProtoLoaderService',
                );

                return service;
            }
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
     * Checks if the path is a directory
     * @param p Path to check
     * @returns True if path is a directory
     */
    private isDirectory(p: string): boolean {
        try {
            return fs.statSync(p).isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Checks if the path is a glob pattern
     * @param p Path to check
     * @returns True if path contains glob pattern characters
     */
    private isGlobPattern(p: string): boolean {
        return /[*?{}[\]!]/.test(p);
    }

    /**
     * Finds all proto files in a directory or matching a glob pattern
     * @param pathPattern Directory path or glob pattern
     * @returns Array of file paths
     */
    private async findProtoFiles(pathPattern: string): Promise<string[]> {
        if (this.isDirectory(pathPattern)) {
            // Convert directory path to glob pattern
            pathPattern = path.join(pathPattern, '**', '*.proto');
        }

        return glob(pathPattern);
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
                    this.logger.warn(
                        `Package part ${part} not found, returning current level`,
                        'ProtoLoaderService',
                    );
                    return acc;
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
