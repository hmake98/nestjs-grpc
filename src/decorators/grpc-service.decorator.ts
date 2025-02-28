import { SetMetadata } from '@nestjs/common';
import { GRPC_SERVICE_METADATA } from '../constants';

export interface GrpcServiceOptions {
    /**
     * Service name as defined in the proto file
     */
    serviceName?: string;

    /**
     * The proto package name
     */
    package?: string;

    /**
     * The proto file path (relative to the application root)
     */
    protoPath?: string;
}

/**
 * Decorator that marks a class as a gRPC service.
 * @param serviceNameOrOptions The service name as defined in the proto file or options object
 */
export function GrpcService(serviceNameOrOptions: string | GrpcServiceOptions): ClassDecorator {
    const options =
        typeof serviceNameOrOptions === 'string'
            ? { serviceName: serviceNameOrOptions }
            : serviceNameOrOptions;

    return SetMetadata(GRPC_SERVICE_METADATA, options);
}
