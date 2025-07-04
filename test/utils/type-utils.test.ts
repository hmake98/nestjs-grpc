import * as protobuf from 'protobufjs';

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
    TypeOptions,
} from '../../src/utils/type-utils';

// Mock protobuf
jest.mock('protobufjs');

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
                'getUser(request: GetUserRequest, metadata?: any): Observable<GetUserResponse>',
            );
            expect(result).toContain(
                'createUser(request: CreateUserRequest, metadata?: any): Observable<CreateUserResponse>',
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
    });
});
