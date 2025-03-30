import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { GRPC_METADATA_PARAM } from '../constants';

/**
 * Parameter decorator that extracts gRPC metadata from the request
 * @param metadataKey Optional specific metadata key to extract
 */
export const GrpcMetadata = createParamDecorator(
    (metadataKey: string | undefined, ctx: ExecutionContext) => {
        const [, , metadata] = ctx.getArgs();

        // If no metadata is available or it's not a Metadata object, return undefined or empty object
        if (!metadata || !(metadata instanceof Metadata)) {
            return metadataKey ? undefined : {};
        }

        // If no specific key was requested, return the whole metadata
        if (!metadataKey) {
            return metadata;
        }

        // Get values for the specific key
        const values = metadata.get(metadataKey);

        // Return undefined if no values found
        if (values.length === 0) {
            return undefined;
        }

        // If there's only one value, return it directly
        if (values.length === 1) {
            return values[0].toString();
        }

        // Otherwise return all values as an array
        return values.map(v => v.toString());
    },
);

// Helper function to register metadata parameters
export function registerMetadataParam(
    target: object,
    key: string | symbol,
    index: number,
    metadataKey?: string,
): void {
    // Store parameter index and key in metadata
    const existingParams = Reflect.getMetadata(GRPC_METADATA_PARAM, target.constructor, key) || [];
    existingParams.push({ index, key: metadataKey });
    Reflect.defineMetadata(GRPC_METADATA_PARAM, existingParams, target.constructor, key);
}

// Manual parameter decorator for registering metadata params
export function GrpcMetadataParam(metadataKey?: string): ParameterDecorator {
    return (target, key, index) => {
        if (key === undefined) return;
        registerMetadataParam(target, key, index, metadataKey);
    };
}

/**
 * Gets the authorization token from gRPC metadata
 */
export const GrpcAuthToken = createParamDecorator((_, ctx: ExecutionContext) => {
    const [, , metadata] = ctx.getArgs();

    // Ensure we have metadata
    if (!metadata || !(metadata instanceof Metadata)) {
        return undefined;
    }

    // Get the authorization header
    const values = metadata.get('authorization');
    if (values.length === 0) {
        return undefined;
    }

    const authHeader = values[0].toString();

    // Handle Bearer token format
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    return authHeader;
});
