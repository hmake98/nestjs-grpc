# nestjs-grpc

<div align="center">

[![npm version](https://badge.fury.io/js/nestjs-grpc.svg)](https://badge.fury.io/js/nestjs-grpc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)

**Production-ready NestJS package for type-safe gRPC microservices with controller-based architecture**

[Quick Start](#-quick-start) • [Documentation](#-documentation) • [Examples](#-examples) • [API Reference](#-api-reference)

</div>

## ✨ Features

- 🎯 **Controller-Based Architecture** - Familiar NestJS controller pattern for gRPC handlers
- 🛡️ **Type Safety** - Full TypeScript support with auto-generated types from proto files
- 🔄 **Streaming Support** - All gRPC streaming patterns (unary, server, client, bidirectional)
- ⚡ **High Performance** - Optimized for production with connection pooling and caching
- 🛠️ **CLI Tools** - Generate TypeScript definitions from proto files with `nestjs-grpc generate`
- 🔒 **Security** - Built-in TLS support and flexible authentication options
- 📊 **Advanced Logging** - Configurable logging with multiple levels and performance metrics
- 🔌 **Complete DI Support** - Inject any NestJS service into gRPC controllers and clients
- 🔍 **Error Handling** - Comprehensive gRPC exception handling with proper status codes
- 🔁 **Retry Logic** - Built-in retry mechanisms with exponential backoff
- 📡 **Client Management** - Automatic connection pooling with cleanup and caching

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
import { GrpcModule } from 'nestjs-grpc';
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
                level: 'debug',
                logErrors: true,
                logPerformance: true,
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
import { GrpcController, GrpcMethod, GrpcStream, GrpcException } from 'nestjs-grpc';
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
    async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
        try {
            const isValid = await this.authService.validateToken(request.token);
            const user = isValid ? await this.authService.getUserFromToken(request.token) : null;

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
        const user = await this.authService.validateUser(request.email, request.password);

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
                    observer.error(GrpcException.internal('Failed to stream users'));
                });
        });
    }
}
```

### 5. Consumer Setup (gRPC Client)

```typescript
// post.module.ts - Service that consumes AuthService
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { GrpcAuthService } from './grpc-auth.service';

@Module({
    imports: [
        // Setup own gRPC server
        GrpcModule.forProvider({
            protoPath: './protos/post.proto',
            package: 'post',
            url: '0.0.0.0:50052',
        }),

        // Setup gRPC clients for external services
        GrpcModule.forConsumer({
            serviceName: 'AuthService',
            protoPath: './protos/auth.proto',
            package: 'auth',
            url: 'auth-service:50051',
            timeout: 10000,
            maxRetries: 3,
            retryDelay: 1000,
        }),
    ],
    controllers: [PostController],
    providers: [PostService, GrpcAuthService],
})
export class PostModule {}

// grpc-auth.service.ts
import { Injectable } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';

@Injectable()
export class GrpcAuthService {
    constructor(private readonly grpcClient: GrpcClientService) {}

    async validateToken(token: string): Promise<boolean> {
        try {
            const result = await this.grpcClient.call<ValidateTokenRequest, ValidateTokenResponse>(
                'AuthService',
                'ValidateToken',
                { token }
            );
            return result.valid;
        } catch (error) {
            console.error('Token validation failed:', error);
            return false;
        }
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
                level: 'log',
                logErrors: true,
                logPerformance: false,
            },
        }),
    ],
    controllers: [ServiceController],
})
export class ServiceModule {}
```

#### Consumer Mode (Client)

For services that call other gRPC services:

```typescript
@Module({
    imports: [
        GrpcModule.forConsumer({
            serviceName: 'ExternalService',
            protoPath: './protos/external.proto',
            package: 'external',
            url: 'external-service:50051',
            secure: false,
            timeout: 30000, // 30 seconds
            maxRetries: 3,
            retryDelay: 1000, // 1 second
            channelOptions: {
                'grpc.keepalive_time_ms': 120000,
                'grpc.keepalive_timeout_ms': 20000,
            },
        }),
    ],
    providers: [ExternalServiceClient],
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
                    level: configService.get('NODE_ENV') === 'development' ? 'debug' : 'log',
                    logErrors: true,
                    logPerformance: configService.get('GRPC_LOG_PERFORMANCE') === 'true',
                },
            }),
        }),
    ],
})
export class AppModule {}
```

### CLI Code Generation

The `nestjs-grpc` CLI tool helps generate TypeScript definitions from your proto files.

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

| Option                   | Description                                    | Default                 |
| ------------------------ | ---------------------------------------------- | ----------------------- |
| `-p, --proto`            | Path to proto file, directory, or glob pattern | `"./protos/**/*.proto"` |
| `-o, --output`           | Output directory for generated files           | `"./src/generated"`     |
| `-c, --classes`          | Generate classes instead of interfaces         | `false`                 |
| `--no-comments`          | Disable comments in generated files            | `false`                 |
| `-f, --package-filter`   | Filter by package name                         | -                       |
| `-v, --verbose`          | Enable verbose logging                         | `false`                 |

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
@GrpcMethod('MethodName')
async handleMethod(request: RequestType): Promise<ResponseType> {
    // Implementation
}

// Method name inferred from function name
@GrpcMethod()
async methodName(request: RequestType): Promise<ResponseType> {
    // Implementation
}
```

#### @GrpcStream

Marks a method as a gRPC streaming handler:

```typescript
@GrpcStream('StreamMethod')
streamMethod(request: RequestType): Observable<ResponseType> {
    return new Observable(observer => {
        // Streaming implementation
    });
}
```

### Client Service

The `GrpcClientService` provides methods for all gRPC call types:

#### Unary Calls

```typescript
async makeCall(): Promise<ResponseType> {
    return this.grpcClient.call<RequestType, ResponseType>(
        'ServiceName',
        'MethodName',
        { /* request data */ },
        {
            timeout: 5000,
            maxRetries: 2,
            retryDelay: 1000,
        }
    );
}
```

#### Server Streaming

```typescript
streamFromServer(): Observable<ResponseType> {
    return this.grpcClient.serverStream<RequestType, ResponseType>(
        'ServiceName',
        'StreamMethod',
        { /* request data */ }
    );
}
```

#### Client Streaming

```typescript
async streamToServer(requests: Observable<RequestType>): Promise<ResponseType> {
    return this.grpcClient.clientStream<RequestType, ResponseType>(
        'ServiceName',
        'StreamMethod',
        requests
    );
}
```

#### Bidirectional Streaming

```typescript
bidirectionalStream(requests: Observable<RequestType>): Observable<ResponseType> {
    return this.grpcClient.bidiStream<RequestType, ResponseType>(
        'ServiceName',
        'StreamMethod',
        requests
    );
}
```

## 🛡️ Error Handling

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
            throw GrpcException.notFound('User not found', { userId: request.id });
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

            const existingUser = await this.userService.findByEmail(request.email);
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
GrpcException.ok()                    // 0
GrpcException.cancelled()             // 1  
GrpcException.unknown()               // 2
GrpcException.invalidArgument()       // 3
GrpcException.deadlineExceeded()      // 4
GrpcException.notFound()              // 5
GrpcException.alreadyExists()         // 6
GrpcException.permissionDenied()      // 7
GrpcException.resourceExhausted()     // 8
GrpcException.failedPrecondition()    // 9
GrpcException.aborted()               // 10
GrpcException.outOfRange()            // 11
GrpcException.unimplemented()         // 12
GrpcException.internal()              // 13
GrpcException.unavailable()           // 14
GrpcException.dataLoss()              // 15
GrpcException.unauthenticated()       // 16
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
                    },
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        authService = module.get<AuthService>(AuthService);
    });

    it('should validate token successfully', async () => {
        const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
        jest.spyOn(authService, 'validateToken').mockResolvedValue(true);
        jest.spyOn(authService, 'getUserFromToken').mockResolvedValue(mockUser);

        const result = await controller.validateToken({ token: 'valid-token' });

        expect(result).toEqual({
            valid: true,
            user: mockUser,
        });
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

    it('should validate token', async () => {
        const mockResponse = { valid: true, user: { id: '1' } };
        jest.spyOn(grpcClient, 'call').mockResolvedValue(mockResponse);

        const result = await service.validateToken('test-token');

        expect(grpcClient.call).toHaveBeenCalledWith(
            'AuthService',
            'ValidateToken',
            { token: 'test-token' }
        );
        expect(result).toBe(true);
    });
});
```

## 📊 Logging Configuration

### Basic Logging Setup

```typescript
GrpcModule.forProvider({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051',
    logging: {
        enabled: true,
        level: 'debug', // debug, verbose, log, warn, error
        logErrors: true, // Log all errors
        logPerformance: true, // Log performance metrics
        logDetails: true, // Log request/response details
    },
});
```

### Environment-Based Logging

```typescript
GrpcModule.forProviderAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
        protoPath: config.get('GRPC_PROTO_PATH'),
        package: config.get('GRPC_PACKAGE'),
        url: config.get('GRPC_URL'),
        logging: {
            enabled: config.get('GRPC_LOGGING_ENABLED', 'true') === 'true',
            level: config.get('NODE_ENV') === 'development' ? 'debug' : 'log',
            logErrors: true,
            logPerformance: config.get('GRPC_LOG_PERFORMANCE', 'false') === 'true',
            logDetails: config.get('NODE_ENV') === 'development',
        },
    }),
});
```

## 🔧 Configuration Options

### Complete Configuration Interface

```typescript
interface GrpcOptions {
    // Required
    protoPath: string | string[];     // Path to proto file(s)
    package: string | string[];       // Proto package name(s)

    // Connection
    url?: string;                     // gRPC server URL (default: 'localhost:50051')
    secure?: boolean;                 // Use TLS (default: false)

    // TLS Configuration
    rootCerts?: Buffer;              // Root certificates for TLS
    privateKey?: Buffer;             // Private key for TLS
    certChain?: Buffer;              // Certificate chain for TLS

    // Message Limits
    maxSendMessageSize?: number;      // Max send message size (default: 4MB)
    maxReceiveMessageSize?: number;   // Max receive message size (default: 4MB)

    // Client Options (Consumer mode)
    timeout?: number;                 // Request timeout (default: 30000ms)
    maxRetries?: number;             // Max retry attempts (default: 3)
    retryDelay?: number;             // Delay between retries (default: 1000ms)
    channelOptions?: object;         // gRPC channel options

    // Logging
    logging?: {
        enabled?: boolean;            // Enable/disable logging (default: true)
        level?: string;              // Log level (default: 'log')
        logErrors?: boolean;         // Log errors (default: true)
        logPerformance?: boolean;    // Log performance metrics (default: false)
        logDetails?: boolean;        // Log request/response details (default: false)
    };
}
```

## 🚀 Performance Tips

### Connection Pooling

The package automatically handles connection pooling with a 5-minute TTL and periodic cleanup:

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
GrpcModule.forProvider({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051', // Ensure server is running on this port
    logging: {
        level: 'debug', // Enable debug logging
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
GrpcModule.forProvider({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051',
    logging: {
        level: 'debug',
        logErrors: true,
        logPerformance: true,
        logDetails: true,
    },
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/hmake98/nestjs-grpc.git
cd nestjs-grpc
npm install
npm run build
npm test
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
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

- [GitHub Issues](https://github.com/hmake98/nestjs-grpc/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/hmake98/nestjs-grpc/discussions) - Community support and questions

---

**Made with ❤️ for the NestJS community**

⭐ Star us on GitHub if this package helped you!