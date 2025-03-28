import * as protobuf from 'protobufjs';

/**
 * Type mapping from protobuf to TypeScript
 */
export const TYPE_MAPPING: Record<string, string> = {
    double: 'number',
    float: 'number',
    int32: 'number',
    int64: 'string',
    uint32: 'number',
    uint64: 'string',
    sint32: 'number',
    sint64: 'string',
    fixed32: 'number',
    fixed64: 'string',
    sfixed32: 'number',
    sfixed64: 'string',
    bool: 'boolean',
    string: 'string',
    bytes: 'Uint8Array',
};

/**
 * Simple options for type generation
 */
export interface TypeOptions {
    /** Whether to generate classes instead of interfaces */
    useClasses?: boolean;

    /** Whether to include comments from the proto file */
    includeComments?: boolean;

    /** Package name to filter (only generate types for this package) */
    packageFilter?: string;
}

/**
 * Maps a protobuf type to a TypeScript type
 * @param type The protobuf type
 * @param isRepeated Whether the field is repeated
 * @returns The corresponding TypeScript type
 */
export function mapProtoTypeToTs(type: string, isRepeated = false): string {
    const mappedType = TYPE_MAPPING[type] || type;
    return isRepeated ? `${mappedType}[]` : mappedType;
}

/**
 * Gets a TypeScript representation of a protobuf enum
 * @param enumType The protobuf enum
 * @param options Generation options
 * @returns TypeScript enum definition
 */
export function getEnumDefinition(enumType: protobuf.Enum, options?: TypeOptions): string {
    let definition = '';

    // Add comment if available and comments are enabled
    if (options?.includeComments && enumType.comment) {
        definition += `/**\n * ${enumType.comment.replace(/\n/g, '\n * ')}\n */\n`;
    }

    definition += `export enum ${enumType.name} {\n`;

    Object.entries(enumType.values).forEach(([key, value]) => {
        definition += `  ${key} = ${value},\n`;
    });

    definition += '}\n';
    return definition;
}

/**
 * Gets a TypeScript interface/class representation of a protobuf message
 * @param messageType The protobuf message type
 * @param options Generation options
 * @returns TypeScript interface/class definition
 */
export function getMessageDefinition(messageType: protobuf.Type, options?: TypeOptions): string {
    let definition = '';

    // Add comment if available and comments are enabled
    if (options?.includeComments && messageType.comment) {
        definition += `/**\n * ${messageType.comment.replace(/\n/g, '\n * ')}\n */\n`;
    }

    // Generate class or interface
    if (options?.useClasses) {
        definition += `export class ${messageType.name} {\n`;
    } else {
        definition += `export interface ${messageType.name} {\n`;
    }

    messageType.fieldsArray.forEach(field => {
        // Add field comment if available and comments are enabled
        if (options?.includeComments && field.comment) {
            definition += `  /**\n   * ${field.comment.replace(/\n/g, '\n   * ')}\n   */\n`;
        }

        const fieldType = mapProtoTypeToTs(field.type, field.repeated);
        const isOptional = !field.required;
        definition += `  ${field.name}${isOptional ? '?' : ''}: ${fieldType};\n`;
    });

    definition += '}\n';
    return definition;
}

/**
 * Gets a TypeScript interface for a gRPC service client
 * @param serviceType The protobuf service type
 * @param options Generation options
 * @returns TypeScript interface definition for the client
 */
export function getServiceClientDefinition(
    serviceType: protobuf.Service,
    options?: TypeOptions,
): string {
    let definition = '';

    // Add comment if available and comments are enabled
    if (options?.includeComments && serviceType.comment) {
        definition += `/**\n * ${serviceType.comment.replace(/\n/g, '\n * ')}\n */\n`;
    }

    definition += `export interface ${serviceType.name}Client {\n`;

    serviceType.methodsArray.forEach(method => {
        // Add method comment if available and comments are enabled
        if (options?.includeComments && method.comment) {
            definition += `  /**\n   * ${method.comment.replace(/\n/g, '\n   * ')}\n   */\n`;
        }

        // Convert method name to camelCase
        const methodName = method.name.charAt(0).toLowerCase() + method.name.slice(1);
        const inputType = method.requestType.split('.').pop();
        const outputType = method.responseType.split('.').pop();

        // Handle streaming methods
        if (method.responseStream) {
            definition += `  ${methodName}(request: ${inputType}): Observable<${outputType}>;\n`;
        } else {
            definition += `  ${methodName}(request: ${inputType}): Observable<${outputType}>;\n`;
        }
    });

    definition += '}\n';
    return definition;
}

/**
 * Gets a TypeScript interface for a gRPC service implementation
 * @param serviceType The protobuf service type
 * @param options Generation options
 * @returns TypeScript interface definition for the implementation
 */
export function getServiceInterfaceDefinition(
    serviceType: protobuf.Service,
    options?: TypeOptions,
): string {
    let definition = '';

    // Add comment if available and comments are enabled
    if (options?.includeComments && serviceType.comment) {
        definition += `/**\n * Controller interface for ${serviceType.name} service\n */\n`;
    }

    definition += `export interface ${serviceType.name}Interface {\n`;

    serviceType.methodsArray.forEach(method => {
        // Add method comment if available and comments are enabled
        if (options?.includeComments && method.comment) {
            definition += `  /**\n   * ${method.comment.replace(/\n/g, '\n   * ')}\n   */\n`;
        }

        // Convert method name to camelCase
        const methodName = method.name.charAt(0).toLowerCase() + method.name.slice(1);
        const inputType = method.requestType.split('.').pop();
        const outputType = method.responseType.split('.').pop();

        // Handle streaming methods
        if (method.responseStream) {
            definition += `  ${methodName}(request: ${inputType}): Observable<${outputType}>;\n`;
        } else {
            definition += `  ${methodName}(request: ${inputType}): Promise<${outputType}> | Observable<${outputType}>;\n`;
        }
    });

    definition += '}\n';
    return definition;
}

/**
 * Generates TypeScript type definitions from a protobuf root
 * @param root The protobuf root
 * @param options Generation options
 * @returns The generated TypeScript definitions
 */
export function generateTypeDefinitions(root: protobuf.Root, options?: TypeOptions): string {
    let typeDefinitions = '// This file is auto-generated by nestjs-grpc\n\n';
    typeDefinitions += "import { Observable } from 'rxjs';\n\n";

    // Process all nested types recursively
    function processNamespace(namespace: protobuf.NamespaceBase, prefix = ''): void {
        namespace.nestedArray.forEach(nested => {
            const fullName = prefix ? `${prefix}.${nested.name}` : nested.name;

            // Skip if package filter is provided and doesn't match
            if (options?.packageFilter && !fullName.startsWith(options.packageFilter)) {
                return;
            }

            if (nested instanceof protobuf.Type) {
                typeDefinitions += getMessageDefinition(nested, options) + '\n';
                // Process nested messages
                processNamespace(nested, fullName);
            } else if (nested instanceof protobuf.Service) {
                typeDefinitions += getServiceClientDefinition(nested, options) + '\n';
                typeDefinitions += getServiceInterfaceDefinition(nested, options) + '\n';
            } else if (nested instanceof protobuf.Enum) {
                typeDefinitions += getEnumDefinition(nested, options) + '\n';
            } else if (nested instanceof protobuf.Namespace) {
                processNamespace(nested, fullName);
            }
        });
    }

    processNamespace(root);
    return typeDefinitions;
}
