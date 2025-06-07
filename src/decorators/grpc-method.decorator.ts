import { GRPC_METHOD_METADATA } from '../constants';

import type { GrpcMethodOptions } from '../interfaces';

/**
 * Decorator that marks a method as a gRPC service method.
 * @param methodNameOrOptions The method name as defined in the proto file or options object
 */
export function GrpcMethod(methodNameOrOptions?: string | GrpcMethodOptions): MethodDecorator {
    const options: GrpcMethodOptions =
        typeof methodNameOrOptions === 'string'
            ? { methodName: methodNameOrOptions }
            : (methodNameOrOptions ?? {});

    return (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
        // If no method name is provided, use the method name
        options.methodName ??= key.toString();

        // Ensure metadata is applied to the prototype, not the constructor
        Reflect.defineMetadata(GRPC_METHOD_METADATA, options, target, key);

        // Explicitly return the descriptor to match the expected method signature
        return descriptor;
    };
}
