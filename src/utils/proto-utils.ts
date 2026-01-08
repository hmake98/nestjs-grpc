import * as fs from 'fs';
import * as path from 'path';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as protobuf from 'protobufjs';

import type { Options } from '@grpc/proto-loader';

/**
 * Default options for proto loading with enhanced stability and compatibility.
 * These settings ensure consistent behavior across different protobuf versions.
 */
const defaultOptions: Options = {
    /** Preserve original field names (don't convert to camelCase) */
    keepCase: true,
    /** Convert long values to strings for JavaScript compatibility */
    longs: String,
    /** Convert enum values to strings */
    enums: String,
    /** Include default values for optional fields */
    defaults: true,
    /** Handle oneof fields properly */
    oneofs: true,
    /** Ensure arrays are handled correctly */
    arrays: true,
    /** Ensure objects are handled correctly */
    objects: true,
    /** Directories to search for imported proto files */
    includeDirs: [],
};

/**
 * Validates and normalizes a proto file path.
 * Ensures the path is valid and accessible.
 *
 * @param protoPath - Path to the proto file or directory
 * @returns Normalized absolute path
 * @throws Error if path is invalid or inaccessible
 *
 * @example
 * ```typescript
 * const validPath = validateProtoPath('./protos/service.proto');
 * console.log('Using proto file:', validPath);
 * ```
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
 * Validates and normalizes proto loader options.
 * Merges user options with sensible defaults and validates critical settings.
 *
 * @param options - Proto loader options to validate and merge
 * @returns Validated and normalized options object
 * @throws Error if options are invalid
 *
 * @example
 * ```typescript
 * const options = validateOptions({
 *   keepCase: false,
 *   includeDirs: ['./protos', './shared']
 * });
 * ```
 */
function validateOptions(options: Options): Options {
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
 * Loads a protobuf file and returns the parsed gRPC package definition.
 * Handles validation, error recovery, and provides detailed error messages.
 *
 * @param protoPath - Path to the .proto file or directory
 * @param options - Proto loader options for customizing parsing behavior
 * @returns Promise that resolves to the loaded gRPC package definition
 * @throws Error if the proto file cannot be loaded or parsed
 *
 * @example
 * ```typescript
 * // Load a single proto file
 * const packageDef = await loadProto('./protos/auth.proto');
 *
 * // Load with custom options
 * const packageDef = await loadProto('./protos/auth.proto', {
 *   keepCase: false,
 *   includeDirs: ['./shared-protos']
 * });
 *
 * // Use the loaded definition
 * const grpcServices = grpc.loadPackageDefinition(packageDef);
 * ```
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
 * Retrieves a specific gRPC service constructor from a loaded package definition.
 * Navigates through the package hierarchy to find the requested service.
 *
 * @param packageDefinition - Loaded gRPC package definition
 * @param packageName - Dot-separated package name (e.g., 'com.example.auth')
 * @param serviceName - Name of the service to retrieve
 * @returns Service constructor function for creating client instances
 * @throws Error if package or service is not found
 *
 * @example
 * ```typescript
 * const packageDef = await loadProto('./auth.proto');
 * const services = grpc.loadPackageDefinition(packageDef);
 *
 * // Get the AuthService from com.example.auth package
 * const AuthService = getServiceByName(services, 'com.example.auth', 'AuthService');
 *
 * // Create a client instance
 * const client = new AuthService('localhost:50051', grpc.credentials.createInsecure());
 * ```
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
function getPackageByName(
    packageDefinition: grpc.GrpcObject,
    packageName: string,
): grpc.GrpcObject | null {
    try {
        validatePackageDefinition(packageDefinition);

        /* istanbul ignore next */
        if (!packageName || typeof packageName !== 'string') {
            return packageDefinition;
        }

        const trimmedPackageName = packageName.trim();
        /* istanbul ignore next */
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
                return null;
            }

            current = current[part] as grpc.GrpcObject;
        }

        return current;
    } catch (error) {
        throw new Error(`Failed to find package '${packageName}': ${error.message}`);
    }
}
