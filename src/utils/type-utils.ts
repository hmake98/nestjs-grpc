import { TYPE_MAPPING } from '../constants';

import type { TypeOptions } from '../interfaces';
import type * as protobuf from 'protobufjs';

/**
 * Converts snake_case to camelCase
 * @param str The snake_case string
 * @returns The camelCase string
 */
function snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts PascalCase to camelCase
 * @param str The PascalCase string
 * @returns The camelCase string
 */
function pascalToCamel(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Formats a field name according to TypeScript conventions
 * @param fieldName The original field name
 * @returns The formatted field name in camelCase
 */
export function formatFieldName(fieldName: string): string {
    // Always convert snake_case to camelCase
    return snakeToCamel(fieldName);
}

/**
 * Formats a method name according to TypeScript conventions
 * @param methodName The original method name
 * @returns The formatted method name in camelCase
 */
export function formatMethodName(methodName: string): string {
    // Always convert snake_case to camelCase and ensure it starts with lowercase
    const camelCase = snakeToCamel(methodName);
    return pascalToCamel(camelCase);
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
        // Always convert enum key to camelCase
        const formattedKey = formatFieldName(key);
        definition += `  ${formattedKey} = ${value},\n`;
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

        // Always format field name (convert snake_case to camelCase)
        const fieldName = formatFieldName(field.name);
        const isRepeated = field.repeated || (field as any).rule === 'repeated';
        const fieldType = mapProtoTypeToTs(field.type, isRepeated);
        const isOptional = !field.required;

        // Add original field name as comment if it was converted
        if (options?.includeComments && fieldName !== field.name) {
            definition += `  /** Original proto field: ${field.name} */\n`;
        }

        definition += `  ${fieldName}${isOptional ? '?' : ''}: ${fieldType};\n`;
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

        // Always format method name (convert snake_case to camelCase and ensure lowercase start)
        const methodName = formatMethodName(method.name);
        const inputType = method.requestType;
        const outputType = method.responseType;

        // Add original method name as comment if it was converted
        if (
            options?.includeComments &&
            methodName !== method.name.charAt(0).toLowerCase() + method.name.slice(1)
        ) {
            definition += `  /** Original proto method: ${method.name} */\n`;
        }

        // Handle streaming methods
        if (method.responseStream) {
            definition += `  ${methodName}(request: ${inputType}, metadata?: GrpcMetadata): Observable<${outputType}>;\n`;
        } else {
            definition += `  ${methodName}(request: ${inputType}, metadata?: GrpcMetadata): Observable<${outputType}>;\n`;
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

        // Always format method name (convert snake_case to camelCase and ensure lowercase start)
        const methodName = formatMethodName(method.name);
        const inputType = method.requestType;
        const outputType = method.responseType;

        // Add original method name as comment if it was converted
        if (
            options?.includeComments &&
            methodName !== method.name.charAt(0).toLowerCase() + method.name.slice(1)
        ) {
            definition += `  /** Original proto method: ${method.name} */\n`;
        }

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
    let typeDefinitions = '// This file is auto-generated by nestjs-grpc\n';
    typeDefinitions += '// Field names have been converted from snake_case to camelCase\n\n';
    typeDefinitions += "import { Observable } from 'rxjs';\n\n";
    typeDefinitions +=
        'export type GrpcMetadata = Record<string, string | string[] | Buffer | Buffer[]>;\n\n';

    // Process all nested types recursively
    function processNamespace(namespace: protobuf.NamespaceBase, prefix = ''): void {
        namespace.nestedArray.forEach(nested => {
            const fullName = prefix ? `${prefix}.${nested.name}` : nested.name;

            // Skip if package filter is provided and doesn't match
            if (options?.packageFilter && !fullName.startsWith(options.packageFilter)) {
                return;
            }

            if (nested.constructor?.name === 'Type') {
                typeDefinitions += `${getMessageDefinition(nested as protobuf.Type, options)}\n`;
                // Process nested messages
                if ((nested as any).nestedArray) {
                    processNamespace(nested as protobuf.NamespaceBase, fullName);
                }
            } else if (nested.constructor?.name === 'Service') {
                // Only include client interface if explicitly enabled
                if (options?.includeClientInterfaces !== false) {
                    typeDefinitions += `${getServiceClientDefinition(nested as protobuf.Service, options)}\n`;
                }
                typeDefinitions += `${getServiceInterfaceDefinition(nested as protobuf.Service, options)}\n`;
            } else if (nested.constructor?.name === 'Enum') {
                typeDefinitions += `${getEnumDefinition(nested as protobuf.Enum, options)}\n`;
            } else if (nested.constructor?.name === 'Namespace') {
                if ((nested as any).nestedArray) {
                    processNamespace(nested as protobuf.NamespaceBase, fullName);
                }
            }
        });
    }

    processNamespace(root);
    return typeDefinitions;
}
