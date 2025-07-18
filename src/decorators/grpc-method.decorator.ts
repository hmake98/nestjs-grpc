import { GRPC_METHOD_METADATA } from '../constants';

import type { GrpcMethodOptions } from '../interfaces';

/**
 * Decorator that marks a method as a gRPC service method handler.
 * Used on server-side controller methods to handle incoming gRPC unary calls.
 *
 * @param methodNameOrOptions - The method name as defined in the proto file or options object
 *
 * @example
 * ```typescript
 * @GrpcController('AuthService')
 * export class AuthController {
 *   // Basic method mapping - method name matches proto definition
 *   @GrpcMethod()
 *   async login(request: LoginRequest): Promise<LoginResponse> {
 *     const user = await this.authService.validateUser(request.email, request.password);
 *     return { token: this.jwtService.sign({ sub: user.id }) };
 *   }
 *
 *   // Explicit method name mapping
 *   @GrpcMethod('GetUserProfile')
 *   async getUserInfo(request: UserRequest): Promise<UserResponse> {
 *     const user = await this.userService.findById(request.userId);
 *     return { user: { id: user.id, name: user.name, email: user.email } };
 *   }
 *
 *   // Method with custom timeout
 *   @GrpcMethod({ methodName: 'ProcessPayment', timeout: 60000 })
 *   async handlePayment(request: PaymentRequest): Promise<PaymentResponse> {
 *     const result = await this.paymentService.processPayment(request);
 *     return { success: result.success, transactionId: result.id };
 *   }
 * }
 * ```
 */
export function GrpcMethod(methodNameOrOptions?: string | GrpcMethodOptions): MethodDecorator {
    const options: GrpcMethodOptions =
        typeof methodNameOrOptions === 'string'
            ? { methodName: methodNameOrOptions }
            : (methodNameOrOptions ?? {});

    return (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
        if (!descriptor || typeof descriptor.value !== 'function') {
            throw new Error('@GrpcMethod can only be applied to methods');
        }

        // If no method name is provided, use the method name
        options.methodName ??= key.toString();

        if (!options.methodName || options.methodName.trim().length === 0) {
            throw new Error('Method name cannot be empty');
        }

        // Ensure metadata is applied to the prototype, not the constructor
        Reflect.defineMetadata(GRPC_METHOD_METADATA, options, target, key);

        return descriptor;
    };
}
