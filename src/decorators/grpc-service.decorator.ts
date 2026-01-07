import { SetMetadata } from '@nestjs/common';

import { GRPC_SERVICE_METADATA } from '../constants';

import type { GrpcServiceOptions } from '../interfaces';

/**
 * Decorator that marks a class as a gRPC service client.
 * Used on the client-side to define service classes that can make gRPC calls.
 *
 * @param serviceNameOrOptions The service name as defined in the proto file or options object
 *
 * @example
 * ```typescript
 * @GrpcService({
 *   serviceName: 'AuthService',
 *   package: 'auth',
 *   url: 'auth-service:50051',
 * })
 * @Injectable()
 * export class AuthServiceClient {
 *   constructor(private readonly grpcClient: GrpcClientService) {}
 *
 *   async login(request: LoginRequest): Promise<LoginResponse> {
 *     return this.grpcClient.call('AuthService', 'Login', request);
 *   }
 * }
 * ```
 */
export function GrpcService(serviceNameOrOptions: string | GrpcServiceOptions): ClassDecorator {
    const options: GrpcServiceOptions =
        typeof serviceNameOrOptions === 'string'
            ? { serviceName: serviceNameOrOptions }
            : serviceNameOrOptions;

    if (!options.serviceName || typeof options.serviceName !== 'string') {
        throw new Error('Service name is required and must be a string');
    }

    if (options.serviceName.trim().length === 0) {
        throw new Error('Service name cannot be empty');
    }

    return (target: any) => {
        if (!target || typeof target !== 'function') {
            throw new Error('@GrpcService can only be applied to classes');
        }

        // Set the service metadata
        SetMetadata(GRPC_SERVICE_METADATA, options)(target);

        return target;
    };
}
