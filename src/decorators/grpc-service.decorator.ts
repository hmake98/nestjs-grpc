import { SetMetadata } from '@nestjs/common';
import { GRPC_SERVICE_METADATA } from '../constants';
import { GrpcServiceOptions } from 'src/interfaces/grpc-service-options.interface';

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
