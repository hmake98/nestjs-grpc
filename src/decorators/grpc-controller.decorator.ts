import { SetMetadata, Injectable, Controller } from '@nestjs/common';

import { GRPC_CONTROLLER_METADATA } from '../constants';

import type { GrpcControllerOptions } from '../interfaces';

/**
 * Decorator that marks a class as a gRPC controller for handling RPC methods.
 * This is used on the server-side to define RPC handlers that correspond to
 * methods defined in your proto files.
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

    if (!options.serviceName || typeof options.serviceName !== 'string') {
        throw new Error('Service name is required and must be a string');
    }

    if (options.serviceName.trim().length === 0) {
        throw new Error('Service name cannot be empty');
    }

    return (target: any) => {
        if (!target || typeof target !== 'function') {
            throw new Error('@GrpcController can only be applied to classes');
        }

        // Apply the NestJS Controller decorator
        Controller()(target);

        // Ensure the class is injectable
        Injectable()(target);

        // Set the controller metadata
        SetMetadata(GRPC_CONTROLLER_METADATA, options)(target);

        return target;
    };
}
