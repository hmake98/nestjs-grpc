import * as fs from 'fs';
import * as path from 'path';

import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { glob } from 'glob';

import { GRPC_OPTIONS } from '../constants';
import { GrpcOptions } from '../interfaces';
import { GrpcLogger } from '../utils/logger';
import { loadProto, getServiceByName } from '../utils/proto-utils';

/**
 * Service responsible for loading and managing protobuf definitions.
 * Handles both single proto files and directories with multiple proto files.
 * Provides caching and validation to ensure proto definitions are loaded efficiently.
 *
 * Features:
 * - Async loading with promise caching to prevent duplicate loads
 * - Support for glob patterns and directory scanning
 * - Comprehensive error handling and validation
 * - Service discovery and method enumeration
 *
 * @example
 * ```typescript
 * // Inject the service
 * constructor(private protoService: GrpcProtoService) {}
 *
 * // Get loaded proto definition
 * const definition = this.protoService.getProtoDefinition();
 *
 * // Load a specific service
 * const authService = await this.protoLoader.loadService('AuthService');
 * ```
 */
@Injectable()
export class GrpcProtoService implements OnModuleInit {
    private readonly logger: GrpcLogger;
    /** Cached proto definition object */
    private protoDefinition: any = null;
    /** Flag indicating if proto files have been loaded */
    private isLoaded = false;
    /** Promise for ongoing load operation to prevent concurrent loads */
    private loadingPromise: Promise<any> | null = null;

    /**
     * Constructs the ProtoLoaderService with gRPC options
     *
     * @param options - Global gRPC configuration including proto paths and packages
     */
    constructor(@Inject(GRPC_OPTIONS) private readonly options: GrpcOptions) {
        this.logger = new GrpcLogger({
            ...options.logging,
            context: 'ProtoLoader',
        });
        this.validateOptions();
    }

    /**
     * Validates that required gRPC options are properly configured.
     * Ensures proto path and package name are valid.
     *
     * @throws Error if validation fails
     * @private
     */
    private validateOptions(): void {
        if (!this.options) {
            throw new Error('GRPC_OPTIONS is required');
        }

        if (!this.options.protoPath || typeof this.options.protoPath !== 'string') {
            throw new Error('protoPath is required and must be a string');
        }

        if (!this.options.package || typeof this.options.package !== 'string') {
            throw new Error('package is required and must be a string');
        }

        if (this.options.logging?.level === 'debug') {
            this.logger.debug(
                `ProtoLoader initialized with path: ${this.options.protoPath}, package: ${this.options.package}`,
            );
        }
    }

    /**
     * Lifecycle hook called when the module is initialized.
     * Automatically loads proto files based on the configured options.
     *
     * @throws Error if proto loading fails
     */
    async onModuleInit(): Promise<void> {
        try {
            this.logger.lifecycle('Loading proto files', {
                path: this.options.protoPath,
                package: this.options.package,
            });

            await this.load();

            this.logger.lifecycle('Proto files loaded successfully');
        } catch (error) {
            this.logger.error('Failed to load proto files', error);
            throw error;
        }
    }

    /**
     * Loads proto files and returns the parsed service definitions.
     * Implements caching to prevent duplicate loads and handles concurrent requests.
     *
     * @returns Promise that resolves to the loaded proto service definitions
     * @throws Error if loading fails
     *
     * @example
     * ```typescript
     * const services = await this.protoLoader.load();
     * console.log('Available services:', Object.keys(services));
     * ```
     */
    async load(): Promise<any> {
        // Return existing loading promise if already in progress
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        // Return cached definition if already loaded
        if (this.isLoaded && this.protoDefinition) {
            return this.protoDefinition;
        }

        // Start loading process
        this.loadingPromise = this.performLoad();

        try {
            const result = await this.loadingPromise;
            this.isLoaded = true;

            if (this.options.logging?.level === 'debug') {
                const serviceNames = this.getLoadedServiceNames(result);
                this.logger.debug(`Loaded services: ${serviceNames.join(', ')}`);
            }

            return result;
        } catch (error) {
            this.loadingPromise = null; // Reset to allow retry
            throw error;
        }
    }

    /**
     * Gets the names of loaded services for logging
     */
    private getLoadedServiceNames(definition: any): string[] {
        const serviceNames: string[] = [];

        try {
            if (definition && typeof definition === 'object') {
                for (const [key, value] of Object.entries(definition)) {
                    if (typeof value === 'function') {
                        serviceNames.push(key);
                    }
                }
            }
        } catch {
            // Ignore errors in service name extraction
        }

        return serviceNames;
    }

    /**
     * Performs the actual loading logic
     */
    private async performLoad(): Promise<any> {
        const { protoPath, package: packageName, loaderOptions } = this.options;

        try {
            this.validateProtoPath(protoPath);

            if (this.isDirectory(protoPath) || this.isGlobPattern(protoPath)) {
                return await this.loadMultipleProtoFiles(protoPath, packageName, loaderOptions);
            } else {
                return await this.loadSingleProtoFile(protoPath, packageName, loaderOptions);
            }
        } catch (error) {
            throw new Error(`Failed to load proto file(s): ${error.message}`);
        }
    }

    /**
     * Validates proto path exists and is accessible
     */
    private validateProtoPath(protoPath: string): void {
        if (!protoPath.includes('*') && !this.isGlobPattern(protoPath)) {
            try {
                fs.accessSync(protoPath, fs.constants.R_OK);
            } catch {
                throw new Error(`Proto path is not accessible: ${protoPath}`);
            }
        }
    }

    /**
     * Loads multiple proto files from directory or glob pattern
     */
    private async loadMultipleProtoFiles(
        protoPath: string,
        packageName: string,
        loaderOptions: any,
    ): Promise<any> {
        const protoFiles = await this.findProtoFiles(protoPath);

        if (protoFiles.length === 0) {
            throw new Error(`No proto files found in ${protoPath}`);
        }

        this.logger.lifecycle(`Found ${protoFiles.length} proto files`);

        const services = {};
        const errors: string[] = [];

        for (const file of protoFiles) {
            try {
                if (this.options.logging?.level === 'debug') {
                    this.logger.debug(`Loading proto file: ${file}`);
                }

                const packageDef = await loadProto(file, loaderOptions);
                const fileServices = this.getServiceByPackageName(packageDef, packageName);

                if (fileServices && typeof fileServices === 'object') {
                    Object.assign(services, fileServices);
                    this.logger.debug(
                        `Loaded services from ${file}: ${Object.keys(fileServices).join(', ')}`,
                    );
                }
            } catch (error) {
                const errorMsg = `Error loading proto file ${file}: ${error.message}`;
                errors.push(errorMsg);

                if (this.options.logging?.logErrors !== false) {
                    this.logger.error(errorMsg, error);
                }
            }
        }

        if (Object.keys(services).length === 0) {
            throw new Error(`No services loaded successfully. Errors: ${errors.join('; ')}`);
        }

        this.logger.lifecycle('Proto files loaded successfully', {
            totalFiles: protoFiles.length,
            successfulFiles: protoFiles.length - errors.length,
            failedFiles: errors.length,
            totalServices: Object.keys(services).length,
        });

        this.protoDefinition = services;
        return services;
    }

    /**
     * Loads a single proto file
     */
    private async loadSingleProtoFile(
        protoPath: string,
        packageName: string,
        loaderOptions: any,
    ): Promise<any> {
        try {
            const packageDefinition = await loadProto(protoPath, loaderOptions);
            const services = this.getServiceByPackageName(packageDefinition, packageName);

            if (!services || (typeof services === 'object' && Object.keys(services).length === 0)) {
                throw new Error(`No services found in package '${packageName}'`);
            }

            this.protoDefinition = services;
            return services;
        } catch (error) {
            throw new Error(`Failed to load proto file ${protoPath}: ${error.message}`);
        }
    }

    /**
     * Gets the loaded proto definition with validation
     */
    getProtoDefinition(): any {
        if (!this.isLoaded || !this.protoDefinition) {
            throw new Error('Proto files have not been loaded yet. Call load() first.');
        }

        return this.protoDefinition;
    }

    /**
     * Loads a specific service from the proto file(s)
     */
    async loadService(serviceName: string): Promise<any> {
        try {
            this.validateServiceName(serviceName);

            const { protoPath, package: packageName, loaderOptions } = this.options;

            if (this.isDirectory(protoPath) || this.isGlobPattern(protoPath)) {
                return await this.loadServiceFromMultipleFiles(
                    serviceName,
                    protoPath,
                    packageName,
                    loaderOptions,
                );
            } else {
                return await this.loadServiceFromSingleFile(
                    serviceName,
                    protoPath,
                    packageName,
                    loaderOptions,
                );
            }
        } catch (error) {
            throw new Error(`Failed to load service ${serviceName}: ${error.message}`);
        }
    }

    /**
     * Validates service name parameter
     */
    private validateServiceName(serviceName: string): void {
        if (!serviceName || typeof serviceName !== 'string') {
            throw new Error('Service name is required and must be a string');
        }

        if (serviceName.trim().length === 0) {
            throw new Error('Service name cannot be empty');
        }
    }

    /**
     * Loads service from multiple proto files
     */
    private async loadServiceFromMultipleFiles(
        serviceName: string,
        protoPath: string,
        packageName: string,
        loaderOptions: any,
    ): Promise<any> {
        const protoFiles = await this.findProtoFiles(protoPath);

        if (protoFiles.length === 0) {
            throw new Error(`No proto files found in ${protoPath}`);
        }

        const errors: string[] = [];

        for (const file of protoFiles) {
            try {
                const packageDef = await loadProto(file, loaderOptions);
                const service = getServiceByName(packageDef, packageName, serviceName);

                if (service) {
                    return service;
                }
            } catch (error) {
                errors.push(`${file}: ${error.message}`);
            }
        }

        throw new Error(
            `Service ${serviceName} not found in any proto file. Errors: ${errors.join('; ')}`,
        );
    }

    /**
     * Loads service from single proto file
     */
    private async loadServiceFromSingleFile(
        serviceName: string,
        protoPath: string,
        packageName: string,
        loaderOptions: any,
    ): Promise<any> {
        try {
            const packageDefinition = await loadProto(protoPath, loaderOptions);
            const service = getServiceByName(packageDefinition, packageName, serviceName);

            if (!service) {
                throw new Error(`Service ${serviceName} not found in package ${packageName}`);
            }

            return service;
        } catch (error) {
            throw new Error(`Failed to load service from ${protoPath}: ${error.message}`);
        }
    }

    /**
     * Safely checks if path is a directory
     */
    private isDirectory(filePath: string): boolean {
        try {
            const stats = fs.statSync(filePath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Checks if path contains glob pattern characters
     */
    private isGlobPattern(filePath: string): boolean {
        return /[*?{}[\]!]/.test(filePath);
    }

    /**
     * Finds proto files with error handling
     */
    private async findProtoFiles(pathPattern: string): Promise<string[]> {
        try {
            let pattern = pathPattern;

            // Convert directory to glob pattern
            if (this.isDirectory(pathPattern)) {
                pattern = path.join(pathPattern, '**', '*.proto');
            }

            const files = await glob(pattern, {
                ignore: ['node_modules/**', '**/node_modules/**'],
                absolute: true,
                nodir: true,
            });

            // Validate files exist and are readable
            const validFiles: string[] = [];

            for (const file of files) {
                try {
                    fs.accessSync(file, fs.constants.R_OK);
                    validFiles.push(file);
                } catch (error) {
                    if (this.options.logging?.logErrors !== false) {
                        this.logger.warn(`Cannot read proto file ${file}: ${error.message}`);
                    }
                }
            }

            return validFiles;
        } catch (error) {
            throw new Error(
                `Error finding proto files with pattern ${pathPattern}: ${error.message}`,
            );
        }
    }

    /**
     * Gets services by package name
     */
    private getServiceByPackageName(proto: any, packageName: string): any {
        try {
            if (!proto) {
                throw new Error('Proto definition is null or undefined');
            }

            if (!packageName) {
                return proto;
            }

            const parts = packageName.split('.');
            let current = proto;

            for (const part of parts) {
                if (!current || typeof current !== 'object') {
                    throw new Error(`Invalid package structure at '${part}'`);
                }

                if (!current[part]) {
                    throw new Error(`Package part '${part}' not found`);
                }

                current = current[part];
            }

            return current;
        } catch (error) {
            throw new Error(`Failed to find package ${packageName}: ${error.message}`);
        }
    }
}
