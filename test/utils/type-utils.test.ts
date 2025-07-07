import {
    TYPE_MAPPING,
    snakeToCamel,
    pascalToCamel,
    formatFieldName,
    formatMethodName,
    mapProtoTypeToTs,
    getEnumDefinition,
    getMessageDefinition,
    getServiceClientDefinition,
    getServiceInterfaceDefinition,
    generateTypeDefinitions,
} from '../../src/utils/type-utils';

describe('Type Utils', () => {
    describe('TYPE_MAPPING', () => {
        it('should have correct type mappings', () => {
            expect(TYPE_MAPPING).toEqual({
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
            });
        });
    });

    describe('snakeToCamel', () => {
        it('should convert snake_case to camelCase', () => {
            expect(snakeToCamel('test_service')).toBe('testService');
            expect(snakeToCamel('get_user_by_id')).toBe('getUserById');
            expect(snakeToCamel('user_id')).toBe('userId');
            expect(snakeToCamel('first_name')).toBe('firstName');
        });

        it('should handle edge cases', () => {
            expect(snakeToCamel('')).toBe('');
            expect(snakeToCamel('a')).toBe('a');
            expect(snakeToCamel('_')).toBe('_');
            expect(snakeToCamel('__')).toBe('__');
            expect(snakeToCamel('_a')).toBe('A'); // This matches the actual implementation
            expect(snakeToCamel('a_')).toBe('a_');
        });

        it('should handle multiple underscores', () => {
            expect(snakeToCamel('test__service')).toBe('test_Service');
            expect(snakeToCamel('get___user')).toBe('get__User');
        });
    });

    describe('pascalToCamel', () => {
        it('should convert PascalCase to camelCase', () => {
            expect(pascalToCamel('TestService')).toBe('testService');
            expect(pascalToCamel('GetUserById')).toBe('getUserById');
            expect(pascalToCamel('HTTPRequest')).toBe('hTTPRequest');
            expect(pascalToCamel('XMLParser')).toBe('xMLParser');
        });

        it('should handle edge cases', () => {
            expect(pascalToCamel('')).toBe('');
            expect(pascalToCamel('a')).toBe('a');
            expect(pascalToCamel('A')).toBe('a');
            expect(pascalToCamel('AB')).toBe('aB');
        });
    });

    describe('formatFieldName', () => {
        it('should format field names correctly', () => {
            expect(formatFieldName('user_id')).toBe('userId');
            expect(formatFieldName('USER_ID')).toBe('USER_ID'); // formatFieldName only handles snake_case
            expect(formatFieldName('user_name')).toBe('userName');
            expect(formatFieldName('first_name')).toBe('firstName');
        });

        it('should handle edge cases', () => {
            expect(formatFieldName('')).toBe('');
            expect(formatFieldName('a')).toBe('a');
            expect(formatFieldName('A')).toBe('A'); // Only snake_case conversion
            expect(formatFieldName('_')).toBe('_');
            expect(formatFieldName('__')).toBe('__');
        });
    });

    describe('formatMethodName', () => {
        it('should format method names correctly', () => {
            expect(formatMethodName('get_user')).toBe('getUser');
            expect(formatMethodName('GET_USER')).toBe('gET_USER'); // Only snake_case conversion
            expect(formatMethodName('getUserById')).toBe('getUserById');
            expect(formatMethodName('get_user_by_id')).toBe('getUserById');
        });

        it('should handle edge cases', () => {
            expect(formatMethodName('')).toBe('');
            expect(formatMethodName('a')).toBe('a');
            expect(formatMethodName('A')).toBe('a');
            expect(formatMethodName('_')).toBe('_');
            expect(formatMethodName('__')).toBe('__');
        });
    });

    describe('mapProtoTypeToTs', () => {
        it('should map proto types to TypeScript types', () => {
            expect(mapProtoTypeToTs('string')).toBe('string');
            expect(mapProtoTypeToTs('int32')).toBe('number');
            expect(mapProtoTypeToTs('int64')).toBe('string');
            expect(mapProtoTypeToTs('bool')).toBe('boolean');
            expect(mapProtoTypeToTs('bytes')).toBe('Uint8Array');
        });

        it('should handle repeated fields', () => {
            expect(mapProtoTypeToTs('string', true)).toBe('string[]');
            expect(mapProtoTypeToTs('int32', true)).toBe('number[]');
            expect(mapProtoTypeToTs('bool', true)).toBe('boolean[]');
        });

        it('should handle custom types', () => {
            expect(mapProtoTypeToTs('CustomMessage')).toBe('CustomMessage');
            expect(mapProtoTypeToTs('com.example.CustomMessage')).toBe('com.example.CustomMessage');
        });

        it('should handle repeated custom types', () => {
            expect(mapProtoTypeToTs('CustomMessage', true)).toBe('CustomMessage[]');
            expect(mapProtoTypeToTs('com.example.CustomMessage', true)).toBe(
                'com.example.CustomMessage[]',
            );
        });
    });

    describe('getEnumDefinition', () => {
        it('should generate enum definition', () => {
            const mockEnum = {
                name: 'Status',
                values: {
                    UNKNOWN: 0,
                    ACTIVE: 1,
                    INACTIVE: 2,
                },
            } as any;

            const result = getEnumDefinition(mockEnum);

            expect(result).toContain('export enum Status {');
            expect(result).toContain('UNKNOWN = 0');
            expect(result).toContain('ACTIVE = 1');
            expect(result).toContain('INACTIVE = 2');
        });

        it('should handle empty enum', () => {
            const mockEnum = {
                name: 'EmptyEnum',
                values: {},
            } as any;

            const result = getEnumDefinition(mockEnum);

            expect(result).toContain('export enum EmptyEnum {');
            expect(result).toContain('}');
        });

        it('should include comments when option is set', () => {
            const mockEnum = {
                name: 'Status',
                values: {
                    UNKNOWN: 0,
                },
                comment: 'Status enum',
            } as any;

            const result = getEnumDefinition(mockEnum, { includeComments: true });

            expect(result).toContain('/**');
            expect(result).toContain('* Status enum');
            expect(result).toContain('*/');
        });
    });

    describe('getMessageDefinition', () => {
        it('should generate interface definition by default', () => {
            const mockMessage = {
                name: 'User',
                fieldsArray: [
                    { name: 'id', type: 'int32', id: 1 },
                    { name: 'name', type: 'string', id: 2 },
                ],
            } as any;

            const result = getMessageDefinition(mockMessage);

            expect(result).toContain('export interface User {');
            expect(result).toContain('id?: number');
            expect(result).toContain('name?: string');
        });

        it('should generate class definition when option is set', () => {
            const mockMessage = {
                name: 'User',
                fieldsArray: [
                    { name: 'id', type: 'int32', id: 1 },
                    { name: 'name', type: 'string', id: 2 },
                ],
            } as any;

            const result = getMessageDefinition(mockMessage, { useClasses: true });

            expect(result).toContain('export class User {');
            expect(result).toContain('id?: number');
            expect(result).toContain('name?: string');
        });

        it('should handle repeated fields', () => {
            const mockMessage = {
                name: 'UserList',
                fieldsArray: [{ name: 'users', type: 'User', rule: 'repeated', id: 1 }],
            } as any;

            const result = getMessageDefinition(mockMessage);

            expect(result).toContain('users?: User');
        });

        it('should handle optional fields', () => {
            const mockMessage = {
                name: 'User',
                fieldsArray: [
                    { name: 'id', type: 'int32', id: 1 },
                    { name: 'name', type: 'string', id: 2, optional: true },
                ],
            } as any;

            const result = getMessageDefinition(mockMessage);

            expect(result).toContain('id?: number');
            expect(result).toContain('name?: string');
        });

        it('should include comments when option is set', () => {
            const mockMessage = {
                name: 'User',
                fieldsArray: [{ name: 'id', type: 'int32', id: 1 }],
                comment: 'User message',
            } as any;

            const result = getMessageDefinition(mockMessage, { includeComments: true });

            expect(result).toContain('/**');
            expect(result).toContain('* User message');
            expect(result).toContain('*/');
        });
    });

    describe('getServiceClientDefinition', () => {
        it('should generate service client definition', () => {
            const mockService = {
                name: 'UserService',
                methodsArray: [
                    {
                        name: 'getUser',
                        requestType: 'GetUserRequest',
                        responseType: 'GetUserResponse',
                    },
                    {
                        name: 'createUser',
                        requestType: 'CreateUserRequest',
                        responseType: 'CreateUserResponse',
                    },
                ],
            } as any;

            const result = getServiceClientDefinition(mockService);

            expect(result).toContain('export interface UserServiceClient {');
            expect(result).toContain(
                'getUser(request: GetUserRequest, metadata?: GrpcMetadata): Observable<GetUserResponse>',
            );
            expect(result).toContain(
                'createUser(request: CreateUserRequest, metadata?: GrpcMetadata): Observable<CreateUserResponse>',
            );
        });

        it('should handle service without methods', () => {
            const mockService = {
                name: 'EmptyService',
                methodsArray: [],
            } as any;

            const result = getServiceClientDefinition(mockService);

            expect(result).toContain('export interface EmptyServiceClient {');
            expect(result).toContain('}');
        });

        it('should include comments when option is set', () => {
            const mockService = {
                name: 'UserService',
                methodsArray: [
                    {
                        name: 'getUser',
                        requestType: 'GetUserRequest',
                        responseType: 'GetUserResponse',
                    },
                ],
                comment: 'User service',
            } as any;

            const result = getServiceClientDefinition(mockService, { includeComments: true });

            expect(result).toContain('/**');
            expect(result).toContain('* User service');
            expect(result).toContain('*/');
        });
    });

    describe('getServiceInterfaceDefinition', () => {
        it('should generate service interface definition', () => {
            const mockService = {
                name: 'UserService',
                methodsArray: [
                    {
                        name: 'getUser',
                        requestType: 'GetUserRequest',
                        responseType: 'GetUserResponse',
                    },
                    {
                        name: 'createUser',
                        requestType: 'CreateUserRequest',
                        responseType: 'CreateUserResponse',
                    },
                ],
            } as any;

            const result = getServiceInterfaceDefinition(mockService);

            expect(result).toContain('export interface UserServiceInterface {');
            expect(result).toContain('getUser(request: GetUserRequest): Promise<GetUserResponse>');
            expect(result).toContain(
                'createUser(request: CreateUserRequest): Promise<CreateUserResponse>',
            );
        });

        it('should handle service without methods', () => {
            const mockService = {
                name: 'EmptyService',
                methodsArray: [],
            } as any;

            const result = getServiceInterfaceDefinition(mockService);

            expect(result).toContain('export interface EmptyServiceInterface {');
            expect(result).toContain('}');
        });

        it('should include comments when option is set', () => {
            const mockService = {
                name: 'UserService',
                methodsArray: [
                    {
                        name: 'getUser',
                        requestType: 'GetUserRequest',
                        responseType: 'GetUserResponse',
                    },
                ],
                comment: 'User service',
            } as any;

            const result = getServiceInterfaceDefinition(mockService, { includeComments: true });

            expect(result).toContain('/**');
            expect(result).toContain('* Controller interface for UserService service');
            expect(result).toContain('*/');
        });
    });

    describe('generateTypeDefinitions', () => {
        it('should generate type definitions header', () => {
            const mockRoot = {
                nestedArray: [],
            } as any;

            const result = generateTypeDefinitions(mockRoot);

            expect(result).toContain('// This file is auto-generated by nestjs-grpc');
            expect(result).toContain("import { Observable } from 'rxjs';");
        });

        it('should handle empty root with header', () => {
            const mockRoot = {
                nestedArray: [],
            } as any;

            const result = generateTypeDefinitions(mockRoot);

            expect(result).toContain('// This file is auto-generated by nestjs-grpc');
            expect(result.split('\n').length).toBeGreaterThan(2); // Has header content
        });

        it('should generate full type definitions with enums, messages, and services', () => {
            const mockRoot = {
                nestedArray: [
                    { 
                        name: 'Status',
                        values: { ACTIVE: 1, INACTIVE: 0 },
                        constructor: { name: 'Enum' }
                    },
                    { 
                        name: 'User',
                        fieldsArray: [
                            { name: 'id', type: 'int32', id: 1 },
                            { name: 'status', type: 'Status', id: 2 }
                        ],
                        constructor: { name: 'Type' }
                    },
                    { 
                        name: 'UserService',
                        methodsArray: [
                            {
                                name: 'getUser',
                                requestType: 'GetUserRequest',
                                responseType: 'User'
                            }
                        ],
                        constructor: { name: 'Service' }
                    }
                ]
            } as any;

            const result = generateTypeDefinitions(mockRoot);

            expect(result).toContain('export enum Status');
            expect(result).toContain('export interface User');
            expect(result).toContain('export interface UserServiceClient');
            expect(result).toContain('export interface UserServiceInterface');
        });

        it('should handle nested namespaces', () => {
            const mockRoot = {
                nestedArray: [
                    {
                        name: 'com',
                        nestedArray: [
                            {
                                name: 'example',
                                nestedArray: [
                                    {
                                        name: 'User',
                                        fieldsArray: [{ name: 'id', type: 'int32', id: 1 }],
                                        constructor: { name: 'Type' }
                                    }
                                ]
                            }
                        ],
                        constructor: { name: 'Namespace' }
                    }
                ]
            } as any;

            const result = generateTypeDefinitions(mockRoot);

            expect(result).toContain('export namespace com');
            expect(result).toContain('export namespace example');
            expect(result).toContain('export interface User');
        });

        it('should handle unknown constructor types gracefully', () => {
            const mockRoot = {
                nestedArray: [
                    {
                        name: 'UnknownType',
                        constructor: { name: 'UnknownConstructor' }
                    }
                ]
            } as any;

            const result = generateTypeDefinitions(mockRoot);

            expect(result).toContain('// This file is auto-generated by nestjs-grpc');
            // Should not crash and should generate header properly
        });

        it('should include comments when option is enabled', () => {
            const mockRoot = {
                nestedArray: [
                    {
                        name: 'User',
                        fieldsArray: [{ name: 'id', type: 'int32', id: 1 }],
                        constructor: { name: 'Type' },
                        comment: 'User type'
                    }
                ]
            } as any;

            const result = generateTypeDefinitions(mockRoot, { includeComments: true });

            expect(result).toContain('/**');
            expect(result).toContain('* User type');
            expect(result).toContain('*/');
        });

        it('should generate proper imports when useClasses is enabled', () => {
            const mockRoot = {
                nestedArray: []
            } as any;

            const result = generateTypeDefinitions(mockRoot, { useClasses: true });

            expect(result).toContain("import { Observable } from 'rxjs';");
            expect(result).toContain('// This file is auto-generated by nestjs-grpc');
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle formatFieldName with multiple consecutive underscores', () => {
            expect(formatFieldName('test___field')).toBe('test__Field');
            expect(formatFieldName('___test')).toBe('__Test');
        });

        it('should handle formatMethodName with uppercase first letter conversion', () => {
            expect(formatMethodName('GetUser')).toBe('getUser');
            expect(formatMethodName('CreateNewUser')).toBe('createNewUser');
            expect(formatMethodName('HTTPRequest')).toBe('hTTPRequest');
        });

        it('should handle mapProtoTypeToTs with undefined repeated flag', () => {
            expect(mapProtoTypeToTs('string', undefined)).toBe('string');
            expect(mapProtoTypeToTs('int32', undefined)).toBe('number');
        });

        it('should handle getEnumDefinition with no comment', () => {
            const mockEnum = {
                name: 'Status',
                values: { ACTIVE: 1 }
            } as any;

            const result = getEnumDefinition(mockEnum, { includeComments: true });

            expect(result).toContain('export enum Status');
            expect(result).not.toContain('/**');
        });

        it('should handle getMessageDefinition with no comment', () => {
            const mockMessage = {
                name: 'User',
                fieldsArray: [{ name: 'id', type: 'int32', id: 1 }]
            } as any;

            const result = getMessageDefinition(mockMessage, { includeComments: true });

            expect(result).toContain('export interface User');
            expect(result).not.toContain('/**');
        });

        it('should handle getServiceClientDefinition with no comment', () => {
            const mockService = {
                name: 'UserService',
                methodsArray: [
                    {
                        name: 'getUser',
                        requestType: 'GetUserRequest',
                        responseType: 'GetUserResponse'
                    }
                ]
            } as any;

            const result = getServiceClientDefinition(mockService, { includeComments: true });

            expect(result).toContain('export interface UserServiceClient');
            expect(result).not.toContain('/**');
        });

        it('should handle getServiceInterfaceDefinition with no comment', () => {
            const mockService = {
                name: 'UserService',
                methodsArray: [
                    {
                        name: 'getUser',
                        requestType: 'GetUserRequest',
                        responseType: 'GetUserResponse'
                    }
                ]
            } as any;

            const result = getServiceInterfaceDefinition(mockService, { includeComments: true });

            expect(result).toContain('export interface UserServiceInterface');
            expect(result).not.toContain('/**');
        });

        it('should handle repeated fields with array syntax correctly', () => {
            const mockMessage = {
                name: 'UserList',
                fieldsArray: [
                    { name: 'users', type: 'User', rule: 'repeated', id: 1 },
                    { name: 'tags', type: 'string', rule: 'repeated', id: 2 }
                ]
            } as any;

            const result = getMessageDefinition(mockMessage);

            expect(result).toContain('users?: User[]');
            expect(result).toContain('tags?: string[]');
        });

        it('should handle nested message types correctly', () => {
            const mockMessage = {
                name: 'UserProfile',
                fieldsArray: [
                    { name: 'address', type: 'Address', id: 1 },
                    { name: 'contact', type: 'com.example.Contact', id: 2 }
                ]
            } as any;

            const result = getMessageDefinition(mockMessage);

            expect(result).toContain('address?: Address');
            expect(result).toContain('contact?: com.example.Contact');
        });

        it('should handle service methods with complex types', () => {
            const mockService = {
                name: 'ComplexService',
                methodsArray: [
                    {
                        name: 'processData',
                        requestType: 'com.example.ProcessRequest',
                        responseType: 'com.example.ProcessResponse'
                    }
                ]
            } as any;

            const clientResult = getServiceClientDefinition(mockService);
            const interfaceResult = getServiceInterfaceDefinition(mockService);

            expect(clientResult).toContain('processData(request: com.example.ProcessRequest, metadata?: GrpcMetadata): Observable<com.example.ProcessResponse>');
            expect(interfaceResult).toContain('processData(request: com.example.ProcessRequest): Promise<com.example.ProcessResponse>');
        });

        it('should handle types with special characters in names', () => {
            expect(mapProtoTypeToTs('User_Profile')).toBe('User_Profile');
            expect(mapProtoTypeToTs('User.Profile')).toBe('User.Profile');
            expect(mapProtoTypeToTs('User-Profile')).toBe('User-Profile');
        });

        it('should handle empty string inputs', () => {
            expect(snakeToCamel('')).toBe('');
            expect(pascalToCamel('')).toBe('');
            expect(formatFieldName('')).toBe('');
            expect(formatMethodName('')).toBe('');
        });

        it('should handle single character inputs', () => {
            expect(snakeToCamel('a')).toBe('a');
            expect(pascalToCamel('A')).toBe('a');
            expect(formatFieldName('a')).toBe('a');
            expect(formatMethodName('A')).toBe('a');
        });

        it('should handle numeric enum values correctly', () => {
            const mockEnum = {
                name: 'Priority',
                values: {
                    LOW: 0,
                    MEDIUM: 5,
                    HIGH: 10
                }
            } as any;

            const result = getEnumDefinition(mockEnum);

            expect(result).toContain('LOW = 0');
            expect(result).toContain('MEDIUM = 5');
            expect(result).toContain('HIGH = 10');
        });

        it('should handle optional parameter defaults', () => {
            const mockMessage = {
                name: 'TestMessage',
                fieldsArray: [{ name: 'field', type: 'string', id: 1 }]
            } as any;

            // Test with undefined options
            const result1 = getMessageDefinition(mockMessage, undefined);
            expect(result1).toContain('export interface TestMessage');

            // Test with empty options
            const result2 = getMessageDefinition(mockMessage, {});
            expect(result2).toContain('export interface TestMessage');
        });
    });
});
