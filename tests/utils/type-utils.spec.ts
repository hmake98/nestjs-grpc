import {
    mapProtoTypeToTs,
    getEnumDefinition,
    getMessageDefinition,
    getServiceClientDefinition,
    getServiceInterfaceDefinition,
    generateTypeDefinitions,
    TYPE_MAPPING,
} from '../../utils/type-utils';

describe('Type Utils', () => {
    describe('mapProtoTypeToTs', () => {
        it('should map primitive protobuf types to TypeScript types', () => {
            // Test each mapping from the TYPE_MAPPING object
            Object.entries(TYPE_MAPPING).forEach(([protoType, tsType]) => {
                expect(mapProtoTypeToTs(protoType)).toBe(tsType);
            });
        });

        it('should handle repeated types by adding array notation', () => {
            expect(mapProtoTypeToTs('string', true)).toBe('string[]');
            expect(mapProtoTypeToTs('int32', true)).toBe('number[]');
            expect(mapProtoTypeToTs('bytes', true)).toBe('Uint8Array[]');
        });

        it('should pass through custom types', () => {
            expect(mapProtoTypeToTs('User')).toBe('User');
            expect(mapProtoTypeToTs('app.UserType')).toBe('app.UserType');
            expect(mapProtoTypeToTs('User', true)).toBe('User[]');
        });
    });

    describe('generateTypeDefinitions', () => {
        it('should generate TypeScript definitions from a protobuf root', () => {
            // Create a mock protobuf root
            const mockRoot = {
                nestedArray: [
                    {
                        name: 'User',
                        fieldsArray: [
                            {
                                name: 'id',
                                type: 'string',
                                repeated: false,
                                required: false,
                                comment: 'User ID',
                            },
                            { name: 'name', type: 'string', repeated: false, required: true },
                            { name: 'emails', type: 'string', repeated: true, required: false },
                        ],
                        comment: 'User message',
                    },
                    {
                        name: 'UserService',
                        methodsArray: [
                            {
                                name: 'GetUser',
                                requestType: 'GetUserRequest',
                                responseType: 'User',
                                responseStream: false,
                                comment: 'Gets a user by ID',
                            },
                            {
                                name: 'ListUsers',
                                requestType: 'ListUsersRequest',
                                responseType: 'User',
                                responseStream: true,
                                comment: 'Lists all users',
                            },
                        ],
                        comment: 'User service',
                    },
                    {
                        name: 'UserStatus',
                        values: {
                            ACTIVE: 0,
                            INACTIVE: 1,
                            SUSPENDED: 2,
                        },
                        comment: 'User status enum',
                    },
                ],
            };

            // Mock the required protobuf.Type, protobuf.Service, and protobuf.Enum interfaces
            mockRoot.nestedArray[0].constructor = { name: 'Type' };
            mockRoot.nestedArray[1].constructor = { name: 'Service' };
            mockRoot.nestedArray[2].constructor = { name: 'Enum' };

            // Generate TypeScript definitions
            const typeDefinitions = generateTypeDefinitions(mockRoot as any, {
                includeComments: true,
                useClasses: false,
            });

            // Verify that the generated definitions include each type
            expect(typeDefinitions).toContain('export interface User');
            expect(typeDefinitions).toContain('export interface UserServiceClient');
            expect(typeDefinitions).toContain('export interface UserServiceController');
            expect(typeDefinitions).toContain('export enum UserStatus');

            // Check specific fields and comments
            expect(typeDefinitions).toContain('id?: string;');
            expect(typeDefinitions).toContain('name: string;');
            expect(typeDefinitions).toContain('emails?: string[];');
            expect(typeDefinitions).toContain('* User message');
            expect(typeDefinitions).toContain('* User ID');
            expect(typeDefinitions).toContain('getUser(request: GetUserRequest): Promise<User>;');
            expect(typeDefinitions).toContain(
                'listUsers(request: ListUsersRequest): Observable<User>;',
            );
            expect(typeDefinitions).toContain('ACTIVE = 0');
            expect(typeDefinitions).toContain('INACTIVE = 1');
            expect(typeDefinitions).toContain('SUSPENDED = 2');
        });

        it('should filter by package name when packageFilter is provided', () => {
            // Create a mock protobuf root with nested packages
            const mockRoot = {
                nestedArray: [
                    {
                        name: 'app',
                        nestedArray: [
                            {
                                name: 'User',
                                fieldsArray: [
                                    {
                                        name: 'id',
                                        type: 'string',
                                        repeated: false,
                                        required: false,
                                    },
                                ],
                                constructor: { name: 'Type' },
                            },
                        ],
                        constructor: { name: 'Namespace' },
                    },
                    {
                        name: 'admin',
                        nestedArray: [
                            {
                                name: 'Admin',
                                fieldsArray: [
                                    {
                                        name: 'id',
                                        type: 'string',
                                        repeated: false,
                                        required: false,
                                    },
                                ],
                                constructor: { name: 'Type' },
                            },
                        ],
                        constructor: { name: 'Namespace' },
                    },
                ],
            };

            // Generate TypeScript definitions with package filter
            const typeDefinitions = generateTypeDefinitions(mockRoot as any, {
                packageFilter: 'app',
            });

            // Verify that only the filtered package types are included
            expect(typeDefinitions).toContain('export interface User');
            expect(typeDefinitions).not.toContain('export interface Admin');
        });

        it('should not include client interfaces when includeClientInterfaces is false', () => {
            const mockRoot = {
                nestedArray: [
                    {
                        name: 'UserService',
                        methodsArray: [
                            {
                                name: 'GetUser',
                                requestType: 'GetUserRequest',
                                responseType: 'User',
                                responseStream: false,
                            },
                        ],
                        constructor: { name: 'Service' },
                    },
                ],
            };

            // Generate TypeScript definitions without client interfaces
            const typeDefinitions = generateTypeDefinitions(mockRoot as any, {
                includeClientInterfaces: false,
            });

            // Verify that client interfaces are not included
            expect(typeDefinitions).not.toContain('export interface UserServiceClient');
            expect(typeDefinitions).toContain('export interface UserServiceController');
        });

        it('should generate classes instead of interfaces when useClasses is true', () => {
            const mockRoot = {
                nestedArray: [
                    {
                        name: 'User',
                        fieldsArray: [
                            { name: 'id', type: 'string', repeated: false, required: false },
                            { name: 'name', type: 'string', repeated: false, required: false },
                        ],
                        constructor: { name: 'Type' },
                    },
                ],
            };

            // Generate TypeScript definitions with classes
            const typeDefinitions = generateTypeDefinitions(mockRoot as any, {
                useClasses: true,
            });

            // Verify that classes are generated instead of interfaces
            expect(typeDefinitions).toContain('export class User');
            expect(typeDefinitions).not.toContain('export interface User');
        });
    });
});
