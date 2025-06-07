import { Inject } from '@nestjs/common';

import { GRPC_SERVICE_METADATA, GRPC_CLIENT_TOKEN_PREFIX } from '../constants';

import type { GrpcServiceOptions } from '../interfaces';

/**
 * Decorator that marks a class as a gRPC service client definition.
 * This is used on the client-side to inject gRPC service clients.
 *
 * @param serviceNameOrOptions The service name as defined in the proto file or options object
 *
 * @example
 * ```typescript
 * @GrpcService('AuthService')
 * export class AuthServiceClient {
 *   // This will be automatically populated with the gRPC client
 * }
 *
 * // Usage in another service
 * @Injectable()
 * export class UserService {
 *   constructor(private authClient: AuthServiceClient) {}
 *
 *   async authenticateUser(token: string) {
 *     return this.authClient.validateToken({ token });
 *   }
 * }
 * ```
 */
export function GrpcService(serviceNameOrOptions: string | GrpcServiceOptions): ClassDecorator {
    const options: GrpcServiceOptions =
        typeof serviceNameOrOptions === 'string'
            ? { serviceName: serviceNameOrOptions }
            : serviceNameOrOptions;

    return (target: any) => {
        // Store service metadata
        Reflect.defineMetadata(GRPC_SERVICE_METADATA, options, target);

        return target;
    };
}

/**
 * Parameter decorator to inject a gRPC client for a specific service.
 * This can be used as an alternative to the @GrpcService class decorator.
 *
 * @param serviceName The service name as defined in the proto file
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(
 *     @InjectGrpcClient('AuthService') private authClient: any,
 *     @InjectGrpcClient('UserService') private userClient: any
 *   ) {}
 *
 *   async getUser(id: string) {
 *     return this.userClient.getUser({ id });
 *   }
 * }
 * ```
 */
export function InjectGrpcClient(serviceName: string): ParameterDecorator {
    if (!serviceName || typeof serviceName !== 'string') {
        throw new Error('Service name is required for @InjectGrpcClient');
    }

    const token = `${GRPC_CLIENT_TOKEN_PREFIX}${serviceName}`;
    return Inject(token);
}
