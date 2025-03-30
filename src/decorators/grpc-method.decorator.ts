import { SetMetadata } from '@nestjs/common';
import { GRPC_METHOD_METADATA } from '../constants';
import { GrpcMethodOptions } from 'src/interfaces/grpc-method-options.interface';

/**
 * Decorator that marks a method as a gRPC service method.
 * @param methodNameOrOptions The method name as defined in the proto file or options object
 */
export function GrpcMethod(methodNameOrOptions?: string | GrpcMethodOptions): MethodDecorator {
    const options =
        typeof methodNameOrOptions === 'string'
            ? { methodName: methodNameOrOptions }
            : methodNameOrOptions || {};

    return (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
        // If no method name is provided, use the method name
        if (!options.methodName) {
            options.methodName = key.toString();
        }

        return SetMetadata(GRPC_METHOD_METADATA, options)(target, key, descriptor);
    };
}
