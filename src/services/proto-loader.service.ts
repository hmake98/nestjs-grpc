import * as fs from 'fs';
import * as path from 'path';

import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { glob } from 'glob';

import { GRPC_OPTIONS } from '../constants';
import { GrpcOptions } from '../interfaces';
import { loadProto, getServiceByName } from '../utils/proto-utils';

@Injectable()
export class ProtoLoaderService implements OnModuleInit {
    private protoDefinition: any;

    constructor(@Inject(GRPC_OPTIONS) private readonly options: GrpcOptions) {}

    /**
     * Initialize the service on module initialization
     */
    async onModuleInit(): Promise<void> {
        await this.load();
    }

    /**
     * Loads the proto file(s) and returns the package definition
     * @returns The package definition
     */
    async load(): Promise<any> {
        const { protoPath, package: packageName, loaderOptions } = this.options;

        try {
            // Check if protoPath is a directory or a glob pattern
            if (this.isDirectory(protoPath) || this.isGlobPattern(protoPath)) {
                // Find all proto files in the directory/pattern
                const protoFiles = await this.findProtoFiles(protoPath);

                if (protoFiles.length === 0) {
                    throw new Error(`No proto files found in ${protoPath}`);
                }

                // Load all found proto files
                const services = {};
                for (const file of protoFiles) {
                    try {
                        const packageDef = await loadProto(file, loaderOptions);
                        const fileServices = this.getServiceByPackageName(packageDef, packageName);

                        // Merge services from multiple files
                        Object.assign(services, fileServices);
                    } catch (fileError) {
                        console.warn(`Error loading proto file ${file}: ${fileError.message}`);
                    }
                }

                this.protoDefinition = services;
                return services;
            } else {
                // Direct file path
                const packageDefinition = await loadProto(protoPath, loaderOptions);
                const services = this.getServiceByPackageName(packageDefinition, packageName);

                this.protoDefinition = services;
                return services;
            }
        } catch (error) {
            throw new Error(`Failed to load proto file(s): ${error.message}`);
        }
    }

    /**
     * Gets the loaded proto definition
     * @returns The proto definition
     */
    getProtoDefinition(): any {
        return this.protoDefinition;
    }

    /**
     * Loads a specific service from the proto file(s)
     * @param serviceName The service name
     * @returns The service definition
     */
    async loadService(serviceName: string): Promise<any> {
        const { protoPath, package: packageName, loaderOptions } = this.options;

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
                return service;
            }
        } catch (error) {
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
            return proto;
        }

        try {
            return packageName.split('.').reduce((acc, part) => {
                if (!acc[part]) {
                    return acc;
                }
                return acc[part];
            }, proto);
        } catch (error) {
            throw new Error(`Failed to find package ${packageName}: ${error.message}`);
        }
    }
}
