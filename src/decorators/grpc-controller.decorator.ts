import { SetMetadata, Injectable } from '@nestjs/common';

import { GRPC_CONTROLLER_METADATA } from '../constants';

import type { GrpcControllerOptions } from '../interfaces';

/**
 * Decorator that marks a class as a gRPC controller for handling RPC methods.
 * This is used on the server-side to define RPC handlers.
 *
 * @param serviceNameOrOptions The service name as defined in the proto file or options object
 *
 * @example
 * ```typescript
 * @GrpcController('AuthService')
 * export class AuthController {
 *   @GrpcMethod('Login')
 *   async login(request: LoginRequest): Promise<LoginResponse> {
 *     // Handle login logic
 *   }
 * }
 * ```
 */
export function GrpcController(
    serviceNameOrOptions: string | GrpcControllerOptions,
): ClassDecorator {
    const options: GrpcControllerOptions =
        typeof serviceNameOrOptions === 'string'
            ? { serviceName: serviceNameOrOptions }
            : serviceNameOrOptions;

    return (target: any) => {
        // Ensure the class is injectable
        Injectable()(target);

        // Set the controller metadata
        SetMetadata(GRPC_CONTROLLER_METADATA, options)(target);

        return target;
    };
}
