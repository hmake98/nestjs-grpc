import { Metadata } from '@grpc/grpc-js';

/**
 * Type for metadata values that can be either strings, buffers, or arrays of them
 */
export type MetadataValue = string | Buffer | string[] | Buffer[];

/**
 * Utility class for working with gRPC metadata
 */
export class MetadataUtils {
    /**
     * Creates a new metadata object from a plain object
     * @param obj Plain object with metadata key-value pairs
     * @returns gRPC Metadata instance
     */
    static fromObject(obj: Record<string, MetadataValue>): Metadata {
        const metadata = new Metadata();

        Object.entries(obj).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => metadata.add(key, v));
            } else {
                metadata.add(key, value);
            }
        });

        return metadata;
    }

    /**
     * Converts gRPC Metadata to a plain JavaScript object
     * @param metadata gRPC Metadata instance
     * @returns Plain object with metadata key-value pairs
     */
    static toObject(metadata: Metadata): Record<string, MetadataValue> {
        const result: Record<string, MetadataValue> = {};
        const metadataMap = metadata.getMap();

        Object.entries(metadataMap).forEach(([key, value]) => {
            // Handle arrays and single values
            if (Array.isArray(value) && value.length === 1) {
                result[key] = value[0];
            } else {
                result[key] = value;
            }
        });

        return result;
    }

    /**
     * Merges multiple metadata objects into a single one
     * @param metadataObjects Array of metadata objects to merge
     * @returns A new metadata object with all key-value pairs
     */
    static merge(...metadataObjects: Metadata[]): Metadata {
        const merged = new Metadata();

        metadataObjects.forEach(metadata => {
            if (!metadata) return;

            const map = metadata.getMap();
            Object.entries(map).forEach(([key, values]) => {
                if (Array.isArray(values)) {
                    values.forEach(value => merged.add(key, value.toString()));
                }
            });
        });

        return merged;
    }

    /**
     * Gets a value from metadata by key
     * @param metadata gRPC Metadata instance
     * @param key Metadata key
     * @param defaultValue Default value if key doesn't exist
     * @returns Value for the key or default value
     */
    static get(metadata: Metadata, key: string, defaultValue?: string): string | undefined {
        const values = metadata.get(key);
        if (values.length === 0) {
            return defaultValue;
        }
        return values[0].toString();
    }

    /**
     * Gets all values for a key from metadata
     * @param metadata gRPC Metadata instance
     * @param key Metadata key
     * @returns Array of values for the key
     */
    static getAll(metadata: Metadata, key: string): string[] {
        const values = metadata.get(key);
        return values.map(v => v.toString());
    }

    /**
     * Checks if metadata has a specific key
     * @param metadata gRPC Metadata instance
     * @param key Metadata key
     * @returns True if the key exists
     */
    static has(metadata: Metadata, key: string): boolean {
        return metadata.get(key).length > 0;
    }

    /**
     * Extracts authorization token from metadata
     * @param metadata gRPC Metadata instance
     * @returns Token string or undefined if not found
     */
    static getAuthToken(metadata: Metadata): string | undefined {
        const authorization = this.get(metadata, 'authorization');

        if (!authorization) {
            return undefined;
        }

        // Handle 'Bearer token' format
        if (authorization.startsWith('Bearer ')) {
            return authorization.substring(7);
        }

        return authorization;
    }

    /**
     * Adds an authorization token to metadata
     * @param metadata gRPC Metadata instance
     * @param token Token string
     * @param scheme Authorization scheme, defaults to 'Bearer'
     */
    static setAuthToken(metadata: Metadata, token: string, scheme = 'Bearer'): void {
        metadata.set('authorization', `${scheme} ${token}`);
    }

    /**
     * Creates a metadata object with an authorization token
     * @param token Token string
     * @param scheme Authorization scheme, defaults to 'Bearer'
     * @returns Metadata object with authorization
     */
    static withAuthToken(token: string, scheme = 'Bearer'): Metadata {
        const metadata = new Metadata();
        this.setAuthToken(metadata, token, scheme);
        return metadata;
    }
}

/**
 * Decorator for extracting metadata from the context (for use in gRPC controllers)
 */
export function GrpcMetadata(metadataKey?: string) {
    return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
        // Store the metadata key and parameter index
        Reflect.defineMetadata(
            'grpc:metadata',
            { key: metadataKey, index: parameterIndex },
            target,
            propertyKey,
        );
    };
}

/**
 * Gets the metadata key and parameter index for a method
 * @param target The target object
 * @param propertyKey The method name
 * @returns Metadata key and parameter index, or undefined if not found
 */
export function getMetadataParams(
    target: any,
    propertyKey: string | symbol,
): { key: string | undefined; index: number } | undefined {
    if (!Reflect.hasMetadata('grpc:metadata', target, propertyKey)) {
        return undefined;
    }

    return Reflect.getMetadata('grpc:metadata', target, propertyKey);
}
