import * as path from 'path';
import * as fs from 'fs';
import * as protobuf from 'protobufjs';
import * as protoLoader from '@grpc/proto-loader';
import { Options } from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';

/**
 * Options for loading proto files
 */
export type ProtoLoaderOptions = Options;

/**
 * Default options for proto loading
 */
const defaultOptions: ProtoLoaderOptions = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
};

/**
 * Loads a proto file and returns the package definition
 * @param protoPath Path to the proto file
 * @param options Proto loader options
 * @returns The loaded package definition
 */
export async function loadProto(
    protoPath: string,
    options: ProtoLoaderOptions = {},
): Promise<grpc.GrpcObject> {
    const resolvedPath = path.resolve(protoPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Proto file not found: ${resolvedPath}`);
    }

    const packageDefinition = await protoLoader.load(resolvedPath, {
        ...defaultOptions,
        ...options,
    });

    return grpc.loadPackageDefinition(packageDefinition);
}

/**
 * Loads a proto file using protobufjs
 * @param protoPath Path to the proto file
 * @returns The loaded protobuf root
 */
export async function loadProtoWithProtobuf(protoPath: string): Promise<protobuf.Root> {
    const resolvedPath = path.resolve(protoPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Proto file not found: ${resolvedPath}`);
    }

    return protobuf.load(resolvedPath);
}

/**
 * Gets a service from a package definition by package name and service name
 * @param packageDefinition The package definition
 * @param packageName The package name (e.g., 'helloworld')
 * @param serviceName The service name (e.g., 'Greeter')
 * @returns The service constructor
 */
export function getServiceByName(
    packageDefinition: grpc.GrpcObject,
    packageName: string,
    serviceName: string,
): any {
    const pkg = getPackageByName(packageDefinition, packageName);

    if (!pkg) {
        throw new Error(`Package ${packageName} not found`);
    }

    if (!pkg[serviceName]) {
        throw new Error(`Service ${serviceName} not found in package ${packageName}`);
    }

    return pkg[serviceName];
}

/**
 * Gets a package from a package definition by name
 * @param packageDefinition The package definition
 * @param packageName The package name (e.g., 'helloworld')
 * @returns The package
 */
export function getPackageByName(
    packageDefinition: grpc.GrpcObject,
    packageName: string,
): grpc.GrpcObject | null {
    if (!packageName) {
        return packageDefinition;
    }

    try {
        return packageName.split('.').reduce((obj, part) => {
            if (!obj || !obj[part]) {
                throw new Error(`Package part ${part} not found`);
            }
            return obj[part] as grpc.GrpcObject;
        }, packageDefinition);
    } catch {
        return null;
    }
}

/**
 * Gets a list of service methods from a service constructor
 * @param serviceConstructor The service constructor
 * @returns Array of method names
 */
export function getServiceMethods(serviceConstructor: any): string[] {
    if (!serviceConstructor || !serviceConstructor.service) {
        return [];
    }

    // Different versions of grpc have different structure
    if (serviceConstructor.service.originalName) {
        return Object.keys(serviceConstructor.service.originalName);
    } else if (serviceConstructor.service.methods) {
        return Object.keys(serviceConstructor.service.methods);
    }

    return [];
}

/**
 * Validates that a method exists in a service
 * @param serviceConstructor The service constructor
 * @param methodName The method name to validate
 * @returns True if the method exists
 */
export function validateServiceMethod(serviceConstructor: any, methodName: string): boolean {
    const methods = getServiceMethods(serviceConstructor);
    return methods.includes(methodName);
}

/**
 * Creates a gRPC server credential
 * @param rootCerts Root CA certificates
 * @param privateKey Server private key
 * @param certChain Server certificate chain
 * @returns Server credentials
 */
export function createServerCredentials(
    rootCerts?: Buffer,
    privateKey?: Buffer,
    certChain?: Buffer,
): grpc.ServerCredentials {
    if (privateKey && certChain) {
        return grpc.ServerCredentials.createSsl(
            rootCerts || null,
            [
                {
                    private_key: privateKey,
                    cert_chain: certChain,
                },
            ],
            false,
        );
    }

    return grpc.ServerCredentials.createInsecure();
}

/**
 * Creates a gRPC client credential
 * @param secure Whether to use secure connection
 * @param rootCerts Root CA certificates
 * @param privateKey Client private key
 * @param certChain Client certificate chain
 * @returns Client credentials
 */
export function createClientCredentials(
    secure = false,
    rootCerts?: Buffer,
    privateKey?: Buffer,
    certChain?: Buffer,
): grpc.ChannelCredentials {
    if (!secure) {
        return grpc.credentials.createInsecure();
    }

    return grpc.credentials.createSsl(rootCerts || null, privateKey || null, certChain || null);
}

/**
 * Creates channel options for a gRPC client
 * @param maxSendSize Maximum send message size
 * @param maxReceiveSize Maximum receive message size
 * @param keepaliveTime Keepalive time in ms
 * @param keepaliveTimeout Keepalive timeout in ms
 * @param additionalOptions Additional channel options
 * @returns Channel options object
 */
export function createChannelOptions(
    maxSendSize?: number,
    maxReceiveSize?: number,
    keepaliveTime = 60000,
    keepaliveTimeout = 20000,
    additionalOptions: Record<string, any> = {},
): Record<string, any> {
    const options: Record<string, any> = {
        'grpc.keepalive_time_ms': keepaliveTime,
        'grpc.keepalive_timeout_ms': keepaliveTimeout,
        'grpc.http2.min_time_between_pings_ms': keepaliveTime,
        'grpc.http2.max_pings_without_data': 0,
        'grpc.keepalive_permit_without_calls': 1,
    };

    if (maxSendSize) {
        options['grpc.max_send_message_length'] = maxSendSize;
    }

    if (maxReceiveSize) {
        options['grpc.max_receive_message_length'] = maxReceiveSize;
    }

    return {
        ...options,
        ...additionalOptions,
    };
}

/**
 * Gets full type name with package prefix
 * @param packageName The package name
 * @param typeName The type name
 * @returns The full type name
 */
export function getFullTypeName(packageName: string, typeName: string): string {
    if (!packageName) {
        return typeName;
    }

    return `${packageName}.${typeName}`;
}
