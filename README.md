# nestjs-grpc

<div align="center">

[![npm version](https://badge.fury.io/js/nestjs-grpc.svg)](https://badge.fury.io/js/nestjs-grpc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Test Coverage](https://img.shields.io/badge/coverage-99.87%25-brightgreen)](https://github.com/hmake98/nestjs-grpc)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

**Production-ready NestJS package for type-safe gRPC microservices with
controller-based architecture**

[Quick Start](#-quick-start) • [Documentation](#-documentation) •
[Examples](#-examples) • [API Reference](#-api-reference) •
[Changelog](#-changelog)

</div>

## ✨ Features

- 🎯 **Controller-Based Architecture** - Familiar NestJS controller pattern for
  gRPC handlers
- 🛡️ **Type Safety** - Full TypeScript support with auto-generated types from
  proto files
- 🔄 **Streaming Support** - All gRPC streaming patterns (unary, server, client,
  bidirectional)
- ⚡ **High Performance** - Optimized for production with connection pooling and
  caching
- 🛠️ **CLI Tools** - Generate TypeScript definitions from proto files with
  `nestjs-grpc generate`
- 🔒 **Security** - Built-in TLS support and flexible authentication options
- 📊 **Advanced Logging** - Configurable logging with GrpcLogLevel enum support
  and flexible context configuration
- 🔌 **Complete DI Support** - Inject any NestJS service into gRPC controllers
  and clients
- 🔍 **Error Handling** - gRPC exception classes with proper status codes and
  custom filter support
- 🔁 **Retry Logic** - Built-in retry mechanisms with exponential backoff
- 📡 **Client Management** - Automatic connection pooling with cleanup and
  caching

## 🚀 Quick Start

### Installation

```bash
npm install nestjs-grpc
```

### 1. Create Proto File

```protobuf
// protos/auth.proto
syntax = "proto3";
package auth;

service AuthService {
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
  rpc Login(LoginRequest) returns (LoginResponse);
  rpc StreamUsers(StreamUsersRequest) returns (stream User);
}

message ValidateTokenRequest {
  string token = 1;
}

message ValidateTokenResponse {
  bool valid = 1;
  User user = 2;
}

message LoginRequest {
  string email = 1;
  string password = 2;
}

message LoginResponse {
  string token = 1;
  User user = 2;
}

message StreamUsersRequest {
  int32 limit = 1;
}

message User {
  string id = 1;
  string email = 2;
  string name = 3;
}
```

### 2. Generate TypeScript Types

```bash
# Generate types from proto files
npx nestjs-grpc generate -p ./protos -o ./src/generated

# Or with options
npx nestjs-grpc generate \
  --proto "./protos/**/*.proto" \
  --output "./src/generated" \
  --classes \
  --verbose
```

### 3. Provider Setup (gRPC Server)

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule, GrpcLogLevel } from 'nestjs-grpc';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
    imports: [
        GrpcModule.forProvider({
            protoPath: './protos/auth.proto',
            package: 'auth',
            url: '0.0.0.0:50051',
            logging: {
                enabled: true,
                level: GrpcLogLevel.DEBUG,
                context: 'GrpcModule',
            },
        }),
    ],
    controllers: [AuthController], // gRPC controllers go here
    providers: [AuthService],
})
export class AppModule {}
```

### 4. Create gRPC Controller

```typescript
// auth.controller.ts
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
    GrpcController,
    GrpcMethod,
    GrpcStream,
    GrpcException,
} from 'nestjs-grpc';
import {
    ValidateTokenRequest,
    ValidateTokenResponse,
    LoginRequest,
    LoginResponse,
    StreamUsersRequest,
    User,
} from './generated/auth';

@GrpcController('AuthService')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @GrpcMethod('ValidateToken')
    async validateToken(
        request: ValidateTokenRequest,
    ): Promise<ValidateTokenResponse> {
        try {
            const isValid = await this.authService.validateToken(request.token);
            const user = isValid
                ? await this.authService.getUserFromToken(request.token)
                : null;

            return {
                valid: isValid,
                user,
            };
        } catch (error) {
            throw GrpcException.internal('Token validation failed');
        }
    }

    @GrpcMethod('Login')
    async login(request: LoginRequest): Promise<LoginResponse> {
        const user = await this.authService.validateUser(
            request.email,
            request.password,
        );

        if (!user) {
            throw GrpcException.unauthenticated('Invalid credentials');
        }

        const token = await this.authService.generateToken(user);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        };
    }

    @GrpcStream('StreamUsers')
    streamUsers(request: StreamUsersRequest): Observable<User> {
        return new Observable(observer => {
            this.authService
                .findAllPaginated(request.limit)
                .then(users => {
                    users.forEach(user => {
                        observer.next({
                            id: user.id,
                            email: user.email,
                            name: user.name,
                        });
                    });
                    observer.complete();
                })
                .catch(error => {
                    observer.error(
                        GrpcException.internal('Failed to stream users'),
                    );
                });
        });
    }
}
```

## 📖 Documentation

### Module Configuration

#### Provider Mode (Server)

For services that provide gRPC endpoints:

```typescript
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';

@Module({
    imports: [
        GrpcModule.forProvider({
            protoPath: './protos/service.proto',
            package: 'service',
            url: '0.0.0.0:50051', // Listen on all interfaces
            secure: false,
            maxSendMessageSize: 4 * 1024 * 1024, // 4MB
            maxReceiveMessageSize: 4 * 1024 * 1024, // 4MB
            logging: {
                enabled: true,
                level: GrpcLogLevel.LOG,
                context: 'GrpcModule',
            },
        }),
    ],
    controllers: [ServiceController],
})
export class ServiceModule {}
```

#### Consumer Mode (Client)

For services that call other gRPC services, use the `@GrpcService` decorator:

```typescript
import { Injectable } from '@nestjs/common';
import { GrpcService, GrpcClientService } from 'nestjs-grpc';

@GrpcService({
    serviceName: 'ExternalService',
    package: 'external',
    url: 'external-service:50051',
    clientOptions: {
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
    },
})
@Injectable()
export class ExternalServiceClient {
    constructor(private readonly grpcClient: GrpcClientService) {}

    async callExternalService(request: any): Promise<any> {
        return this.grpcClient.call(
            'ExternalService',
            'YourMethod',
            request,
        );
    }
}

// Use in module
@Module({
    providers: [ExternalServiceClient],
    exports: [ExternalServiceClient],
})
export class ConsumerModule {}
```

#### Async Configuration

```typescript
@Module({
    imports: [
        GrpcModule.forProviderAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                protoPath: configService.get('GRPC_PROTO_PATH'),
                package: configService.get('GRPC_PACKAGE'),
                url: configService.get('GRPC_URL'),
                secure: configService.get('GRPC_SECURE') === 'true',
                logging: {
                    enabled: configService.get('GRPC_LOGGING_ENABLED') !== 'false',
                    level:
                        configService.get('NODE_ENV') === 'development'
                            ? GrpcLogLevel.DEBUG
                            : GrpcLogLevel.LOG,
                    context: 'GrpcModule',
                },
            }),
        }),
    ],
})
export class AppModule {}
```

### CLI Code Generation

The `nestjs-grpc` CLI tool helps generate TypeScript definitions from your proto
files.

#### Basic Usage

```bash
# Generate types with default settings
npx nestjs-grpc generate

# Specify proto files and output directory
npx nestjs-grpc generate --proto "./protos/**/*.proto" --output "./src/generated"

# Generate classes instead of interfaces
npx nestjs-grpc generate --classes

# Verbose output for debugging
npx nestjs-grpc generate --verbose

# Filter by package name
npx nestjs-grpc generate --package-filter "auth"
```

#### CLI Options

| Option                           | Description                                     | Default                 |
| -------------------------------- | ----------------------------------------------- | ----------------------- |
| `-p, --proto <pattern>`          | Path to proto file, directory, or glob pattern  | `"./protos/**/*.proto"` |
| `-o, --output <dir>`             | Output directory for generated files            | `"./src/generated"`     |
| `-w, --watch`                    | Watch mode for file changes                     | `false`                 |
| `-c, --classes`                  | Generate classes instead of interfaces          | `false`                 |
| `--no-comments`                  | Disable comments in generated files             | `true`                  |
| `--no-client-interfaces`         | Do not generate client interfaces               | `false`                 |
| `-f, --package-filter <package>` | Filter by package name                          | -                       |
| `-r, --recursive`                | Recursively search directories for .proto files | `true`                  |
| `-v, --verbose`                  | Enable verbose logging                          | `false`                 |
| `-s, --silent`                   | Disable all logging except errors               | `false`                 |

### Decorators

#### @GrpcController

Marks a class as a gRPC controller:

```typescript
@GrpcController('ServiceName')
export class ServiceController {
    // Methods here
}

// With options
@GrpcController({
    serviceName: 'ServiceName',
    package: 'custom.package',
})
export class ServiceController {}
```

#### @GrpcMethod

Marks a method as a gRPC unary handler:

```typescript
// Basic usage with method name inferred from function name
@GrpcMethod()
async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    // Implementation
}

// Explicit method name mapping
@GrpcMethod('ValidateToken')
async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    // Implementation
}

// Method with custom timeout
@GrpcMethod({
    methodName: 'ProcessPayment',
    timeout: 60000, // 60 seconds timeout
})
async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    // Implementation
}

// Method with custom timeout (shorthand)
@GrpcMethod({ timeout: 30000 })
async handleLongOperation(request: RequestType): Promise<ResponseType> {
    // Implementation with 30 second timeout
}
```

#### @GrpcStream

Marks a method as a gRPC streaming handler:

```typescript
@GrpcStream('StreamUsers')
streamUsers(request: StreamUsersRequest): Observable<User> {
    return new Observable(observer => {
        // Streaming implementation
        this.userService.findAllPaginated(request.limit)
            .then(users => {
                users.forEach(user => observer.next(user));
                observer.complete();
            })
            .catch(error => {
                observer.error(GrpcException.internal('Failed to stream users'));
            });
    });
}
```

#### @GrpcPayload

Extracts the request payload from gRPC context:

```typescript
@GrpcController('UserService')
export class UserController {
    @GrpcMethod('CreateUser')
    async createUser(
        @GrpcPayload() request: CreateUserRequest,
        @GrpcPayload('metadata') metadata?: any,
    ): Promise<CreateUserResponse> {
        // Access request data and metadata
        console.log('Request metadata:', metadata);
        return this.userService.create(request);
    }
}
```

#### @GrpcService

Marks a class as a gRPC service client (alternative to using
GrpcModule.forConsumer):

```typescript
@GrpcService({
    serviceName: 'AuthService',
    package: 'auth',
    url: 'auth-service:50051',
    clientOptions: {
        timeout: 30000,
        maxRetries: 3,
    },
})
@Injectable()
export class AuthServiceClient {
    constructor(private readonly grpcClient: GrpcClientService) {}

    async validateToken(token: string): Promise<ValidateTokenResponse> {
        return this.grpcClient.call('AuthService', 'ValidateToken', { token });
    }
}
```

### Client Service

The `GrpcClientService` provides methods for all gRPC call types:

#### Unary Calls

```typescript
@Injectable()
export class AuthService {
    constructor(private readonly grpcClient: GrpcClientService) {}

    async validateToken(token: string): Promise<ValidateTokenResponse> {
        return this.grpcClient.call<
            ValidateTokenRequest,
            ValidateTokenResponse
        >(
            'AuthService',
            'ValidateToken',
            { token },
            {
                timeout: 5000,
                maxRetries: 2,
                retryDelay: 1000,
            },
        );
    }
}
```

#### Server Streaming

```typescript
@Injectable()
export class UserService {
    constructor(private readonly grpcClient: GrpcClientService) {}

    getUserStream(limit: number): Observable<User> {
        return this.grpcClient.serverStream<StreamUsersRequest, User>(
            'UserService',
            'StreamUsers',
            { limit },
        );
    }
}
```

#### Client Streaming

```typescript
@Injectable()
export class FileService {
    constructor(private readonly grpcClient: GrpcClientService) {}

    async uploadFile(
        fileChunks: Observable<FileChunk>,
    ): Promise<UploadResponse> {
        return this.grpcClient.clientStream<FileChunk, UploadResponse>(
            'FileService',
            'UploadFile',
            fileChunks,
        );
    }
}
```

#### Bidirectional Streaming

```typescript
@Injectable()
export class ChatService {
    constructor(private readonly grpcClient: GrpcClientService) {}

    startChat(messageStream: Observable<ChatMessage>): Observable<ChatMessage> {
        return this.grpcClient.bidiStream<ChatMessage, ChatMessage>(
            'ChatService',
            'StartChat',
            messageStream,
        );
    }
}
```

#### Client Options

```typescript
@Injectable()
export class AdvancedService {
    constructor(private readonly grpcClient: GrpcClientService) {}

    async makeCallWithOptions(): Promise<ResponseType> {
        return this.grpcClient.call<RequestType, ResponseType>(
            'ServiceName',
            'MethodName',
            { data: 'value' },
            {
                // Connection options
                url: 'custom-service:50051',
                secure: false,

                // Timeout and retry options
                timeout: 30000, // 30 seconds
                maxRetries: 3, // Retry up to 3 times
                retryDelay: 1000, // 1 second delay between retries

                // Channel options for advanced gRPC configuration
                channelOptions: {
                    'grpc.keepalive_time_ms': 120000, // 2 minutes
                    'grpc.keepalive_timeout_ms': 20000, // 20 seconds
                    'grpc.max_concurrent_streams': 100,
                },
            },
        );
    }
}
```

## 🛡️ Error Handling

> **Note**: This package no longer automatically registers a global exception
> filter. Your application's own exception filters will handle errors without
> interference. Use `GrpcException` for throwing gRPC-specific exceptions.

### Using GrpcException

```typescript
import { GrpcException } from 'nestjs-grpc';

@GrpcController('UserService')
export class UserController {
    @GrpcMethod('GetUser')
    async getUser(request: GetUserRequest): Promise<GetUserResponse> {
        const user = await this.userService.findById(request.id);

        if (!user) {
            // Standard gRPC exceptions
            throw GrpcException.notFound('User not found', {
                userId: request.id,
            });
        }

        if (!this.hasPermission(request.requesterId, user.id)) {
            throw GrpcException.permissionDenied('Access denied');
        }

        return { user };
    }

    @GrpcMethod('CreateUser')
    async createUser(request: CreateUserRequest): Promise<CreateUserResponse> {
        try {
            if (!this.validateEmail(request.email)) {
                throw GrpcException.invalidArgument('Invalid email format');
            }

            const existingUser = await this.userService.findByEmail(
                request.email,
            );
            if (existingUser) {
                throw GrpcException.alreadyExists('User already exists');
            }

            const user = await this.userService.create(request);
            return { user };
        } catch (error) {
            if (error instanceof GrpcException) {
                throw error;
            }
            // Convert unknown errors to internal gRPC errors
            throw GrpcException.internal('User creation failed');
        }
    }
}
```

### Available Exception Types

```typescript
// Standard gRPC status codes
GrpcException.ok(); // 0
GrpcException.cancelled(); // 1
GrpcException.unknown(); // 2
GrpcException.invalidArgument(); // 3
GrpcException.deadlineExceeded(); // 4
GrpcException.notFound(); // 5
GrpcException.alreadyExists(); // 6
GrpcException.permissionDenied(); // 7
GrpcException.resourceExhausted(); // 8
GrpcException.failedPrecondition(); // 9
GrpcException.aborted(); // 10
GrpcException.outOfRange(); // 11
GrpcException.unimplemented(); // 12
GrpcException.internal(); // 13
GrpcException.unavailable(); // 14
GrpcException.dataLoss(); // 15
GrpcException.unauthenticated(); // 16
```

### Custom Exception Filters

Since this package no longer registers a global exception filter, you can use
your own exception filters to handle errors:

```typescript
import { ArgumentsHost, Catch, RpcExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { GrpcException } from 'nestjs-grpc';

@Catch()
export class CustomGrpcExceptionFilter implements RpcExceptionFilter<any> {
    catch(exception: any, host: ArgumentsHost): Observable<any> {
        // Handle GrpcException instances
        if (exception instanceof GrpcException) {
            return throwError(() => ({
                code: exception.getCode(),
                message: exception.message,
                details: exception.getDetails(),
            }));
        }

        // Handle other exceptions
        return throwError(() => ({
            code: 13, // INTERNAL
            message: 'Internal server error',
            details: { originalError: exception.message },
        }));
    }
}
```

Register your custom filter in your module:

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GrpcModule } from 'nestjs-grpc';
import { CustomGrpcExceptionFilter } from './custom-grpc-exception.filter';

@Module({
    imports: [
        GrpcModule.forProvider({
            protoPath: './protos/service.proto',
            package: 'service',
            url: 'localhost:50051',
        }),
    ],
    providers: [
        {
            provide: APP_FILTER,
            useClass: CustomGrpcExceptionFilter,
        },
    ],
})
export class AppModule {}
```

## 🧪 Testing

### Testing gRPC Controllers

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GrpcModule } from 'nestjs-grpc';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                GrpcModule.forProvider({
                    protoPath: './test/protos/auth.proto',
                    package: 'auth',
                    url: 'localhost:50051',
                }),
            ],
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: {
                        validateToken: jest.fn(),
                        generateToken: jest.fn(),
                        getUserFromToken: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        authService = module.get<AuthService>(AuthService);
    });

    it('should validate token successfully', async () => {
        const mockUser = {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
        };
        jest.spyOn(authService, 'validateToken').mockResolvedValue(true);
        jest.spyOn(authService, 'getUserFromToken').mockResolvedValue(mockUser);

        const result = await controller.validateToken({ token: 'valid-token' });

        expect(result).toEqual({
            valid: true,
            user: mockUser,
        });
    });

    it('should handle token validation errors', async () => {
        jest.spyOn(authService, 'validateToken').mockRejectedValue(
            new Error('Invalid token'),
        );

        await expect(
            controller.validateToken({ token: 'invalid-token' }),
        ).rejects.toThrow('Token validation failed');
    });
});
```

### Testing gRPC Clients

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GrpcClientService } from 'nestjs-grpc';
import { GrpcAuthService } from './grpc-auth.service';

describe('GrpcAuthService', () => {
    let service: GrpcAuthService;
    let grpcClient: GrpcClientService;

    beforeEach(async () => {
        const mockGrpcClient = {
            call: jest.fn(),
            serverStream: jest.fn(),
            clientStream: jest.fn(),
            bidiStream: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GrpcAuthService,
                {
                    provide: GrpcClientService,
                    useValue: mockGrpcClient,
                },
            ],
        }).compile();

        service = module.get<GrpcAuthService>(GrpcAuthService);
        grpcClient = module.get<GrpcClientService>(GrpcClientService);
    });

    it('should validate token successfully', async () => {
        const mockResponse = {
            valid: true,
            user: { id: '1', email: 'test@example.com' },
        };
        jest.spyOn(grpcClient, 'call').mockResolvedValue(mockResponse);

        const result = await service.validateToken('test-token');

        expect(grpcClient.call).toHaveBeenCalledWith(
            'AuthService',
            'ValidateToken',
            { token: 'test-token' },
        );
        expect(result).toBe(true);
    });

    it('should handle gRPC call failures', async () => {
        jest.spyOn(grpcClient, 'call').mockRejectedValue(
            new Error('Connection failed'),
        );

        const result = await service.validateToken('test-token');

        expect(result).toBe(false);
    });
});
```

### Testing Streaming Methods

```typescript
import { Subject } from 'rxjs';

describe('Streaming Methods', () => {
    it('should handle server streaming', async () => {
        const mockStream = new Subject<User>();
        jest.spyOn(grpcClient, 'serverStream').mockReturnValue(mockStream);

        const result$ = service.getUserStream(10);

        expect(grpcClient.serverStream).toHaveBeenCalledWith(
            'UserService',
            'StreamUsers',
            { limit: 10 },
        );

        // Test stream emissions
        const emitted: User[] = [];
        result$.subscribe(user => emitted.push(user));

        mockStream.next({ id: '1', name: 'John', email: 'john@example.com' });
        mockStream.next({ id: '2', name: 'Jane', email: 'jane@example.com' });
        mockStream.complete();

        expect(emitted).toHaveLength(2);
    });
});
```

## 📊 Logging Configuration

Logging is now configured using the `GrpcLogLevel` enum for type safety and clarity. The logging system supports three simple options: `enabled`, `level`, and `context`.

### Basic Logging Setup

```typescript
import { GrpcLogLevel } from 'nestjs-grpc';

GrpcModule.forProvider({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051',
    logging: {
        enabled: true,
        level: GrpcLogLevel.DEBUG, // GrpcLogLevel.DEBUG | VERBOSE | LOG | WARN | ERROR
        context: 'GrpcModule',
    },
});
```

### Environment-Based Logging

```typescript
import { GrpcLogLevel } from 'nestjs-grpc';

GrpcModule.forProviderAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
        protoPath: config.get('GRPC_PROTO_PATH'),
        package: config.get('GRPC_PACKAGE'),
        url: config.get('GRPC_URL'),
        logging: {
            enabled: config.get('GRPC_LOGGING_ENABLED', 'true') === 'true',
            level: config.get('NODE_ENV') === 'development' ? GrpcLogLevel.DEBUG : GrpcLogLevel.LOG,
            context: 'GrpcModule',
        },
    }),
});
```

### GrpcLogLevel Enum

The `GrpcLogLevel` enum provides type-safe log level selection:

```typescript
enum GrpcLogLevel {
    DEBUG = 'debug',     // Detailed debug information
    VERBOSE = 'verbose', // Verbose logging
    LOG = 'log',         // General logging (default)
    WARN = 'warn',       // Warning messages only
    ERROR = 'error',     // Error messages only
}
```

## 🔧 Configuration Options

### Complete Configuration Interface

#### Provider Mode (Server)

```typescript
interface GrpcOptions {
    // Required
    protoPath: string; // Path to proto file, directory, or glob pattern
    package: string; // Proto package name

    // Connection
    url?: string; // gRPC server URL (default: 'localhost:50051')
    secure?: boolean; // Use TLS (default: false)

    // TLS Configuration
    rootCerts?: Buffer; // Root certificates for TLS
    privateKey?: Buffer; // Private key for TLS
    certChain?: Buffer; // Certificate chain for TLS

    // Message Limits
    maxSendMessageSize?: number; // Max send message size (default: 4MB)
    maxReceiveMessageSize?: number; // Max receive message size (default: 4MB)

    // Proto Loader Options
    loaderOptions?: Options; // Additional options for protobufjs loader

    // Logging
    logging?: {
        enabled?: boolean; // Enable/disable logging (default: true)
        level?: GrpcLogLevel; // Log level (default: GrpcLogLevel.LOG)
        context?: string; // Logger context (default: 'GrpcModule')
    };
}
```

#### Consumer Mode (Client)

```typescript
interface GrpcConsumerOptions {
    // Required
    serviceName: string; // Service name as defined in proto
    protoPath: string; // Path to proto file
    package: string; // Proto package name
    url: string; // Service URL to connect to

    // Connection
    secure?: boolean; // Use TLS (default: false)

    // TLS Configuration
    rootCerts?: Buffer; // Root certificates for TLS
    privateKey?: Buffer; // Private key for TLS
    certChain?: Buffer; // Certificate chain for TLS

    // Timeout and Retry
    timeout?: number; // Request timeout in ms (default: 30000, min: 1000, max: 300000)
    maxRetries?: number; // Max retry attempts (default: 3, min: 0, max: 10)
    retryDelay?: number; // Delay between retries in ms (default: 1000, min: 100, max: 10000)

    // Proto Loader Options
    loaderOptions?: Options; // Additional options for protobufjs loader

    // Channel Options
    channelOptions?: Record<string, any>; // gRPC channel configuration

    // Logging
    logging?: {
        enabled?: boolean; // Enable/disable logging (default: true)
        level?: GrpcLogLevel; // Log level (default: GrpcLogLevel.LOG)
        context?: string; // Logger context (default: 'GrpcModule')
    };
}
```

## 🚀 Performance Tips

### Connection Pooling

The package automatically handles connection pooling with a 5-minute TTL and
periodic cleanup:

```typescript
// Automatic client caching - no configuration needed
// Clients are reused for the same service and automatically cleaned up
```

### Message Size Optimization

```typescript
GrpcModule.forProvider({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051',
    // Optimize for larger messages if needed
    maxSendMessageSize: 16 * 1024 * 1024, // 16MB
    maxReceiveMessageSize: 16 * 1024 * 1024, // 16MB
});
```

### Retry Configuration

```typescript
// Client-side retry with exponential backoff
await this.grpcClient.call('ServiceName', 'MethodName', request, {
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 1000, // Will use exponential backoff: 1s, 2s, 4s
});
```

### Advanced Features

#### Feature Modules

For complex applications, organize your gRPC services into feature modules:

```typescript
// auth.module.ts
@Module({
    imports: [
        GrpcModule.forFeature({
            services: [AuthController],
            providers: [AuthService],
        }),
    ],
    exports: [AuthService],
})
export class AuthModule {}

// user.module.ts
@Module({
    imports: [
        GrpcModule.forFeature({
            services: [UserController],
            providers: [UserService],
        }),
    ],
    exports: [UserService],
})
export class UserModule {}
```

#### Async Configuration

Use async configuration for dynamic settings:

```typescript
import { GrpcLogLevel } from 'nestjs-grpc';

@Module({
    imports: [
        GrpcModule.forProviderAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                protoPath: config.get('GRPC_PROTO_PATH'),
                package: config.get('GRPC_PACKAGE'),
                url: await config.get('GRPC_URL'), // Can be async
                logging: {
                    enabled: config.get('GRPC_LOGGING_ENABLED') !== 'false',
                    level:
                        process.env.NODE_ENV === 'production'
                            ? GrpcLogLevel.WARN
                            : GrpcLogLevel.DEBUG,
                    context: 'GrpcModule',
                },
            }),
        }),
    ],
})
export class AppModule {}
```

#### Health Checks

Implement health checks for your gRPC services:

```typescript
@GrpcController('HealthService')
export class HealthController {
    @GrpcMethod('Check')
    async check(request: HealthCheckRequest): Promise<HealthCheckResponse> {
        // Implement your health check logic
        const isHealthy = await this.checkDatabaseConnection();

        return {
            status: isHealthy
                ? ServingStatus.SERVING
                : ServingStatus.NOT_SERVING,
            message: isHealthy ? 'Service is healthy' : 'Service is unhealthy',
        };
    }
}
```

## 🔧 Troubleshooting

### Common Issues

#### Proto File Loading Issues

```typescript
// Issue: Proto file not found
// Solution: Use absolute paths
GrpcModule.forProvider({
    protoPath: path.join(__dirname, '../protos/service.proto'),
    package: 'service',
});

// Issue: Package not found
// Solution: Ensure package name matches proto file
// In service.proto: package com.example.service;
GrpcModule.forProvider({
    protoPath: './protos/service.proto',
    package: 'com.example.service', // Must match proto file
});
```

#### Connection Issues

```typescript
// Issue: Connection refused
// Solution: Check server URL and ensure server is running
import { GrpcLogLevel } from 'nestjs-grpc';

GrpcModule.forProvider({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051', // Ensure server is running on this port
    logging: {
        level: GrpcLogLevel.DEBUG, // Enable debug logging
    },
});
```

#### Service Registration Issues

```typescript
// Issue: "12 UNIMPLEMENTED" errors
// This indicates the method is not properly registered

// Solution 1: Verify controller decorator
@GrpcController('ServiceName') // Must match proto service name
export class ServiceController {}

// Solution 2: Verify method decorator
@GrpcMethod('MethodName') // Must match proto method name
async methodName(request: RequestType): Promise<ResponseType> {}

// Solution 3: Check proto service/method names match exactly
```

### Debug Mode

Enable comprehensive debugging:

```typescript
import { GrpcLogLevel } from 'nestjs-grpc';

GrpcModule.forProvider({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051',
    logging: {
        enabled: true,
        level: GrpcLogLevel.DEBUG,
        context: 'GrpcModule',
    },
});
```

## 📋 Changelog

### v1.5.0 (Latest)

#### ✨ **New Features**

- **Comprehensive Unit Test Coverage**: Achieved 99.87% statement coverage across
  all three core files:
  - generate.command.ts: 100% line coverage with 36 tests
  - grpc.exception-filter.ts: 98.71% line coverage with 8 advanced tests
  - grpc-client.service.ts: 100% line coverage with advanced streaming and error
    path tests
- **Advanced Error Handling Tests**: Comprehensive error path testing including
  circular references, serialization failures, and stream error propagation
- **Streaming Method Coverage**: Complete test coverage for all gRPC streaming
  patterns (unary, server streaming, client streaming, bidirectional)

#### 🐛 **Bug Fixes**

- Fixed and verified all streaming error paths in serverStream, clientStream,
  and bidiStream methods
- Resolved exception filter edge cases with JSON serialization failures
- Fixed undefined reference issues in request observable error handling
- Improved error handling in proto file loading scenarios

#### 📈 **Performance Improvements**

- **99.87% Statement Coverage**: Complete coverage of core services with
  comprehensive edge case testing
- **99.17% Branch Coverage**: 727 passing tests with thorough branch analysis
- **100% Function Coverage**: All public APIs fully tested
- **SWC Compiler Integration**: 31ms compilation time vs 500ms+ with TypeScript
- **@swc/jest for Tests**: Significantly faster test execution while maintaining
  full TypeScript and decorator support
- Optimized connection pooling with automatic cleanup
- Enhanced logging performance with configurable levels
- Improved retry logic with exponential backoff

#### 🔧 **Breaking Changes**

- Removed automatic global exception filter registration - applications now
  handle their own exception filters
- **Logging system updated**: Removed deprecated logging options (logErrors,
  logPerformance, logDetails). Logging now uses GrpcLogLevel enum with 3
  options: enabled, level, context
- Changed some service methods from async to synchronous for better performance
- Updated CLI option defaults for better developer experience
- **ts-jest removed**: Replaced with @swc/jest for faster test execution

#### 📚 **Documentation**

- Comprehensive README with best practices and integration guides
- Added testing examples for all gRPC call types
- Enhanced configuration documentation with all available options
- Improved troubleshooting section with common issues and solutions
- Complete changelog with version history and feature tracking

#### 🏗️ **Developer Experience**

- Enhanced TypeScript support with strict type checking
- Improved error messages and debugging information
- Better CLI feedback and progress indicators
- Comprehensive test suites with 727 passing tests and 99.87% coverage

### Previous Versions

For complete changelog, see
[GitHub Releases](https://github.com/hmake98/nestjs-grpc/releases)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

### Development Setup

```bash
git clone https://github.com/hmake98/nestjs-grpc.git
cd nestjs-grpc
npm install
npm run build
npm test
```

### Code Quality Standards

This project maintains high code quality standards:

- **Test Coverage**: 99.87% statement coverage, 99.63% branch coverage
- **TypeScript**: Strict type checking enabled
- **Linting**: ESLint with comprehensive rules
- **Formatting**: Prettier for consistent code style

### Running Tests

This project uses **@swc/jest** for fast test execution instead of ts-jest:

```bash
# Run all tests with coverage (recommended)
npm test

# Run tests in watch mode during development
npm run test:watch

# Run tests with coverage report only
npm run test:coverage

# Run tests with debug mode for troubleshooting
npm run test:debug

# Run tests with clean cache
npm run test:clean
```

The SWC/Jest integration in `jest.config.json` provides significantly faster test execution while maintaining full TypeScript and decorator support.

### Build Process

This project uses a hybrid build approach for optimal compilation speed and type safety:

**Build Commands:**
```bash
# Full build (recommended for production)
npm run build

# Compile TypeScript to JavaScript using SWC (31ms for 28 files)
npm run compile

# Generate TypeScript declaration files (.d.ts)
npm run declarations

# Watch mode for development (uses SWC compilation)
npm run build:watch

# Build with TypeScript only (slower, for comparison)
npm run compile:tsc
```

**Build Process Breakdown:**

1. **npm run compile** - Uses SWC for blazing fast compilation:
   - Compiles ~31ms for 28 files
   - No type checking (faster)
   - Produces optimized JavaScript

2. **npm run declarations** - Uses TypeScript for type generation:
   - Generates .d.ts files for type support
   - Runs with `--emitDeclarationOnly` flag
   - Ensures proper TypeScript integration

3. **npm run build** - Complete production build:
   - Cleans dist directory
   - Compiles with SWC
   - Generates TypeScript declarations
   - Copies CLI binary files

**Why SWC?**

SWC (Speedy Web Compiler) provides:
- **Lightning-fast compilation**: ~31ms vs ~500ms+ with TypeScript
- **Production-ready output**: Optimized JavaScript with proper ES module support
- **Full TypeScript support**: Decorators and advanced features work seamlessly
- **Jest integration**: @swc/jest provides fast test execution without sacrificing functionality

**Performance Comparison:**
- SWC compilation: ~31ms
- TypeScript compilation: ~500-1000ms
- Test execution with @swc/jest: Significantly faster than ts-jest

### Release Process

To release a new version:

```bash
# For patch releases (1.2.3 → 1.2.4)
npm run release:patch

# For minor releases (1.2.3 → 1.3.0)
npm run release:minor

# For major releases (1.2.3 → 2.0.0)
npm run release:major

# For beta releases
npm run release:beta

# For release candidates
npm run release:rc

# For dry run (test release without publishing)
npm run release:dry
```

### Pre-commit Checks

Before submitting a PR, ensure all checks pass:

```bash
# Lint and format check
npm run lint:check
npm run format:check

# Build validation
npm run build
npm run validate

# Full test suite
npm test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/hmake98/nestjs-grpc)
- [npm Package](https://www.npmjs.com/package/nestjs-grpc)
- [gRPC Official Documentation](https://grpc.io/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Protocol Buffers Guide](https://developers.google.com/protocol-buffers)

## 🆘 Support

- [GitHub Issues](https://github.com/hmake98/nestjs-grpc/issues) - Bug reports
  and feature requests
- [GitHub Discussions](https://github.com/hmake98/nestjs-grpc/discussions) -
  Community support and questions

---

**Made with ❤️ for the NestJS community**

⭐ Star us on GitHub if this package helped you!
