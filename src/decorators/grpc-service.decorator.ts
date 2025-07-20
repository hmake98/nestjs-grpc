import { Inject, SetMetadata } from '@nestjs/common';

import { GRPC_SERVICE_METADATA, GRPC_CLIENT_TOKEN_PREFIX } from '../constants';

import type { GrpcServiceOptions } from '../interfaces';

/**
 * Decorator that marks a class as a gRPC service client.
 * Used on the client-side to define service classes that can make gRPC calls.
 *
 * @param serviceNameOrOptions The service name as defined in the proto file or options object
 *
 * @example
 * ```typescript
 * @GrpcService('AuthService')
 * export class AuthServiceClient {
 *   constructor(@InjectGrpcClient('AuthService') private client: any) {}
 *
 *   async login(request: LoginRequest): Promise<LoginResponse> {
 *     return this.client.call('login', request);
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

/**
 * Decorator that injects a gRPC client for a specific service.
 * Used in service classes to inject the gRPC client for making calls.
 *
 * @param serviceName The name of the gRPC service to inject
 *
 * @example
 * ```typescript
 * @GrpcService('AuthService')
 * export class AuthServiceClient {
 *   constructor(@InjectGrpcClient('AuthService') private client: any) {}
 *
 *   async login(request: LoginRequest): Promise<LoginResponse> {
 *     return this.client.call('login', request);
 *   }
 * }
 * ```
 */
export function InjectGrpcClient(serviceName: string): ParameterDecorator {
    if (!serviceName || typeof serviceName !== 'string') {
        throw new Error('Service name is required and must be a string for @InjectGrpcClient');
    }

    if (serviceName.trim().length === 0) {
        throw new Error('Service name cannot be empty for @InjectGrpcClient');
    }

    const token = `${GRPC_CLIENT_TOKEN_PREFIX}${serviceName}`;
    return Inject(token);
}
