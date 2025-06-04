import * as fs from 'fs';
import * as path from 'path';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as protobuf from 'protobufjs';

import type { Options } from '@grpc/proto-loader';

/**
 * Default options for proto loading with enhanced stability
 */
const defaultOptions: Options = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    arrays: true,
    objects: true,
    includeDirs: [],
};

/**
 * Validates proto file path
 */
function validateProtoPath(protoPath: string): string {
    if (!protoPath || typeof protoPath !== 'string') {
        throw new Error('Proto path must be a non-empty string');
    }

    const resolvedPath = path.resolve(protoPath.trim());

    try {
        fs.accessSync(resolvedPath, fs.constants.R_OK);
    } catch {
        throw new Error(`Proto file not accessible: ${resolvedPath}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
        throw new Error(`Proto path is not a file: ${resolvedPath}`);
    }

    return resolvedPath;
}

/**
 * Validates and normalizes proto loader options
 */
function validateOptions(options: Options = {}): Options {
    if (typeof options !== 'object' || options === null) {
        throw new Error('Options must be an object');
    }

    // Merge with defaults and validate critical options
    const mergedOptions: Options = {
        ...defaultOptions,
        ...options,
    };

    // Validate specific options
    if (mergedOptions.includeDirs && !Array.isArray(mergedOptions.includeDirs)) {
        throw new Error('includeDirs must be an array');
    }

    return mergedOptions;
}

/**
 * Loads a proto file and returns the package definition with enhanced error handling
 */
export async function loadProto(
    protoPath: string,
    options: Options = {},
): Promise<grpc.GrpcObject> {
    try {
        const validatedPath = validateProtoPath(protoPath);
        const validatedOptions = validateOptions(options);

        const packageDefinition = await protoLoader.load(validatedPath, validatedOptions);

        if (!packageDefinition) {
            throw new Error('Failed to load package definition from proto file');
        }

        const grpcObject = grpc.loadPackageDefinition(packageDefinition);

        if (!grpcObject || typeof grpcObject !== 'object') {
            throw new Error('Failed to create gRPC object from package definition');
        }

        return grpcObject;
    } catch (error) {
        if (error.message.includes('ENOENT')) {
            throw new Error(`Proto file not found: ${protoPath}`);
        } else if (error.message.includes('parse')) {
            throw new Error(`Proto file parse error: ${error.message}`);
        } else if (error.message.includes('EACCES')) {
            throw new Error(`Permission denied accessing proto file: ${protoPath}`);
        } else {
            throw new Error(`Failed to load proto file: ${error.message}`);
        }
    }
}

/**
 * Loads a proto file using protobufjs with enhanced error handling
 */
export async function loadProtoWithProtobuf(protoPath: string): Promise<protobuf.Root> {
    try {
        const validatedPath = validateProtoPath(protoPath);

        const root = await protobuf.load(validatedPath);

        if (!root) {
            throw new Error('Protobufjs returned null root');
        }

        return root;
    } catch (error) {
        if (error.message.includes('ENOENT')) {
            throw new Error(`Proto file not found: ${protoPath}`);
        } else if (error.message.includes('parse')) {
            throw new Error(`Proto file parse error: ${error.message}`);
        } else {
            throw new Error(`Failed to load proto with protobufjs: ${error.message}`);
        }
    }
}

/**
 * Gets a service from a package definition by package name and service name with validation
 */
export function getServiceByName(
    packageDefinition: grpc.GrpcObject,
    packageName: string,
    serviceName: string,
): any {
    try {
        validatePackageDefinition(packageDefinition);
        validatePackageName(packageName);
        validateServiceName(serviceName);

        const pkg = getPackageByName(packageDefinition, packageName);

        if (!pkg) {
            throw new Error(`Package '${packageName}' not found`);
        }

        if (!pkg[serviceName]) {
            const availableServices = Object.keys(pkg).filter(
                key => typeof pkg[key] === 'function',
            );
            throw new Error(
                `Service '${serviceName}' not found in package '${packageName}'. ` +
                    `Available services: ${availableServices.join(', ')}`,
            );
        }

        const service = pkg[serviceName];

        if (typeof service !== 'function') {
            throw new Error(`'${serviceName}' is not a valid service constructor`);
        }

        return service;
    } catch (error) {
        throw new Error(`Failed to get service: ${error.message}`);
    }
}

/**
 * Validates package definition
 */
function validatePackageDefinition(packageDefinition: any): void {
    if (!packageDefinition || typeof packageDefinition !== 'object') {
        throw new Error('Package definition must be a valid object');
    }
}

/**
 * Validates package name
 */
function validatePackageName(packageName: string): void {
    if (!packageName || typeof packageName !== 'string') {
        throw new Error('Package name must be a non-empty string');
    }

    if (packageName.trim().length === 0) {
        throw new Error('Package name cannot be empty');
    }

    // Validate package name format
    const validPackageNameRegex = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
    if (!validPackageNameRegex.test(packageName.trim())) {
        throw new Error('Package name contains invalid characters');
    }
}

/**
 * Validates service name
 */
function validateServiceName(serviceName: string): void {
    if (!serviceName || typeof serviceName !== 'string') {
        throw new Error('Service name must be a non-empty string');
    }

    if (serviceName.trim().length === 0) {
        throw new Error('Service name cannot be empty');
    }

    // Validate service name format
    const validServiceNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    if (!validServiceNameRegex.test(serviceName.trim())) {
        throw new Error('Service name contains invalid characters');
    }
}

/**
 * Gets a package from a package definition by name with enhanced error handling
 */
export function getPackageByName(
    packageDefinition: grpc.GrpcObject,
    packageName: string,
): grpc.GrpcObject | null {
    try {
        validatePackageDefinition(packageDefinition);

        if (!packageName || typeof packageName !== 'string') {
            return packageDefinition;
        }

        const trimmedPackageName = packageName.trim();
        if (trimmedPackageName.length === 0) {
            return packageDefinition;
        }

        const parts = trimmedPackageName.split('.');
        let current = packageDefinition;

        for (const part of parts) {
            if (!part || part.trim().length === 0) {
                throw new Error('Package name contains empty parts');
            }

            if (!current || typeof current !== 'object') {
                throw new Error(`Invalid package structure at '${part}'`);
            }

            if (!current[part]) {
                return null; // Package not found
            }

            current = current[part] as grpc.GrpcObject;
        }

        return current;
    } catch (error) {
        throw new Error(`Failed to find package '${packageName}': ${error.message}`);
    }
}

/**
 * Gets a list of service methods from a service constructor with validation
 */
export function getServiceMethods(serviceConstructor: any): string[] {
    try {
        if (!serviceConstructor) {
            throw new Error('Service constructor is required');
        }

        if (typeof serviceConstructor !== 'function') {
            throw new Error('Service constructor must be a function');
        }

        if (!serviceConstructor.service) {
            console.warn('Service constructor has no service property');
            return [];
        }

        const service = serviceConstructor.service;
        let methods: string[] = [];

        // Try different service structure formats
        if (service.originalName && typeof service.originalName === 'object') {
            methods = Object.keys(service.originalName);
        } else if (service.methods && typeof service.methods === 'object') {
            methods = Object.keys(service.methods);
        } else if (service.methodsMap && typeof service.methodsMap === 'object') {
            methods = Object.keys(service.methodsMap);
        }

        // Filter out invalid method names
        const validMethods = methods.filter(
            method => method && typeof method === 'string' && method.trim().length > 0,
        );

        return validMethods;
    } catch (error) {
        console.warn('Error getting service methods:', error.message);
        return [];
    }
}

/**
 * Creates a gRPC client credential with validation
 */
export function createClientCredentials(
    secure = false,
    rootCerts?: Buffer,
    privateKey?: Buffer,
    certChain?: Buffer,
): grpc.ChannelCredentials {
    try {
        if (!secure) {
            return grpc.credentials.createInsecure();
        }

        // Validate certificates if provided
        if (rootCerts && !Buffer.isBuffer(rootCerts)) {
            throw new Error('rootCerts must be a Buffer');
        }

        if (privateKey && !Buffer.isBuffer(privateKey)) {
            throw new Error('privateKey must be a Buffer');
        }

        if (certChain && !Buffer.isBuffer(certChain)) {
            throw new Error('certChain must be a Buffer');
        }

        return grpc.credentials.createSsl(rootCerts || null, privateKey || null, certChain || null);
    } catch (error) {
        throw new Error(`Failed to create client credentials: ${error.message}`);
    }
}

/**
 * Creates channel options for a gRPC client with validation
 */
export function createChannelOptions(
    maxSendSize?: number,
    maxReceiveSize?: number,
    additionalOptions: Record<string, any> = {},
): Record<string, any> {
    try {
        // Validate size parameters
        if (maxSendSize !== undefined) {
            if (!Number.isInteger(maxSendSize) || maxSendSize <= 0) {
                throw new Error('maxSendSize must be a positive integer');
            }
        }

        if (maxReceiveSize !== undefined) {
            if (!Number.isInteger(maxReceiveSize) || maxReceiveSize <= 0) {
                throw new Error('maxReceiveSize must be a positive integer');
            }
        }

        if (additionalOptions && typeof additionalOptions !== 'object') {
            throw new Error('additionalOptions must be an object');
        }

        const options: Record<string, any> = {
            'grpc.keepalive_time_ms': 60000,
            'grpc.keepalive_timeout_ms': 20000,
            'grpc.http2.min_time_between_pings_ms': 60000,
            'grpc.http2.max_pings_without_data': 0,
            'grpc.keepalive_permit_without_calls': 1,
        };

        // Add size limits if specified
        if (maxSendSize) {
            options['grpc.max_send_message_length'] = maxSendSize;
        }

        if (maxReceiveSize) {
            options['grpc.max_receive_message_length'] = maxReceiveSize;
        }

        // Merge additional options safely
        const safeAdditionalOptions: Record<string, any> = {};

        for (const [key, value] of Object.entries(additionalOptions || {})) {
            if (typeof key === 'string' && key.trim().length > 0) {
                safeAdditionalOptions[key] = value;
            }
        }

        return {
            ...options,
            ...safeAdditionalOptions,
        };
    } catch (error) {
        throw new Error(`Failed to create channel options: ${error.message}`);
    }
}
