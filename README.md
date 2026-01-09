# nestjs-grpc

<div align="center">

[![npm version](https://badge.fury.io/js/nestjs-grpc.svg)](https://badge.fury.io/js/nestjs-grpc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Test Coverage](https://img.shields.io/badge/coverage-99.87%25-brightgreen)](https://github.com/hmake98/nestjs-grpc)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

**Production-ready NestJS package for type-safe gRPC microservices with controller-based architecture**

[Installation](#installation) • [Quick Start](#quick-start) • [API Docs](#decorators) • [Examples](#real-world-example) • [Configuration](#configuration-reference)

</div>

## ✨ Features

- 🎯 **Controller-Based** - Familiar NestJS patterns for gRPC handlers
- 🛡️ **Type-Safe** - Full TypeScript support with auto-generated types from proto files
- 🔄 **All Streaming Patterns** - Unary, server, client, and bidirectional streaming
- ⚡ **Production-Ready** - Connection pooling, caching, and optimized for high performance
- 🛠️ **CLI Generation** - Generate TypeScript types from proto files with `nestjs-grpc generate`
- 🔒 **TLS & Security** - Built-in TLS support and flexible authentication
- 📊 **Configurable Logging** - GrpcLogLevel enum with DEBUG, VERBOSE, LOG, WARN, ERROR
- 🔌 **Full DI Support** - Inject any NestJS service into controllers and clients
- 🔍 **Exception Classes** - gRPC-specific exceptions with proper status codes
- 🔁 **Retry Logic** - Built-in exponential backoff and automatic retries
- 📡 **Auto Connection Pooling** - Automatic client management with cleanup

---

## Installation

```bash
npm install nestjs-grpc
```

---

## Quick Start

### 1. Create a Proto File

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
npx nestjs-grpc generate --proto "./protos/**/*.proto" --output "./src/generated"
```

### 3. Setup Server Module

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
  controllers: [AuthController],
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
import { ValidateTokenRequest, ValidateTokenResponse, LoginRequest, LoginResponse, StreamUsersRequest, User } from './generated/auth';

@GrpcController('AuthService')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('ValidateToken')
  async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    try {
      const isValid = await this.authService.validateToken(request.token);
      const user = isValid ? await this.authService.getUserFromToken(request.token) : null;
      return { valid: isValid, user };
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
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }

  @GrpcStream('StreamUsers')
  streamUsers(request: StreamUsersRequest): Observable<User> {
    return new Observable(observer => {
      this.authService.findAllPaginated(request.limit)
        .then(users => {
          users.forEach(user => observer.next(user));
          observer.complete();
        })
        .catch(() => observer.error(GrpcException.internal('Failed to stream users')));
    });
  }
}
```

### 5. Use the Service (from another microservice)

```typescript
import { Injectable } from '@nestjs/common';
import { GrpcService, GrpcClientService } from 'nestjs-grpc';

@GrpcService({
  serviceName: 'AuthService',
  package: 'auth',
  url: 'auth-service:50051',
  clientOptions: {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
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

---

## Decorators

### @GrpcController

Marks a class as a gRPC service handler:

```typescript
@GrpcController('ServiceName')
export class ServiceController {}

// With options
@GrpcController({ serviceName: 'ServiceName', package: 'custom.package' })
export class ServiceController {}
```

### @GrpcMethod

Handles unary (single request/response) calls:

```typescript
// Auto-infer method name from function name
@GrpcMethod()
async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {}

// Explicit method name
@GrpcMethod('ValidateToken')
async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {}

// With custom timeout
@GrpcMethod({ methodName: 'ProcessPayment', timeout: 60000 })
async processPayment(request: PaymentRequest): Promise<PaymentResponse> {}
```

### @GrpcStream

Handles server streaming (multiple responses for one request):

```typescript
@GrpcStream('StreamUsers')
streamUsers(request: StreamUsersRequest): Observable<User> {
  return new Observable(observer => {
    this.userService.findAllPaginated(request.limit)
      .then(users => {
        users.forEach(user => observer.next(user));
        observer.complete();
      })
      .catch(error => observer.error(GrpcException.internal('Failed to stream users')));
  });
}
```

### @GrpcPayload

Extract request payload and metadata from gRPC context:

```typescript
@GrpcMethod('CreateUser')
async createUser(
  @GrpcPayload() request: CreateUserRequest,
  @GrpcPayload('metadata') metadata?: any,
): Promise<CreateUserResponse> {
  console.log('Metadata:', metadata);
  return this.userService.create(request);
}
```

### @GrpcService

Register a class as a gRPC service client:

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
}
```

---

## Client Service

`GrpcClientService` provides methods for all gRPC call types. Use these in your services to call other gRPC services:

### Unary Calls (Single Request/Response)

```typescript
@Injectable()
export class AuthService {
  constructor(private readonly grpcClient: GrpcClientService) {}

  async validateToken(token: string): Promise<ValidateTokenResponse> {
    return this.grpcClient.call<ValidateTokenRequest, ValidateTokenResponse>(
      'AuthService',
      'ValidateToken',
      { token },
      { timeout: 5000, maxRetries: 2, retryDelay: 1000 }
    );
  }
}
```

### Server Streaming (Multiple Responses)

```typescript
getUserStream(limit: number): Observable<User> {
  return this.grpcClient.serverStream<StreamUsersRequest, User>(
    'UserService',
    'StreamUsers',
    { limit }
  );
}
```

### Client Streaming (Multiple Requests)

```typescript
async uploadFile(fileChunks: Observable<FileChunk>): Promise<UploadResponse> {
  return this.grpcClient.clientStream<FileChunk, UploadResponse>(
    'FileService',
    'UploadFile',
    fileChunks
  );
}
```

### Bidirectional Streaming (Multiple Requests/Responses)

```typescript
startChat(messageStream: Observable<ChatMessage>): Observable<ChatMessage> {
  return this.grpcClient.bidiStream<ChatMessage, ChatMessage>(
    'ChatService',
    'StartChat',
    messageStream
  );
}
```

---

## Error Handling

Use `GrpcException` to throw gRPC-compliant errors with proper status codes:

```typescript
import { GrpcException } from 'nestjs-grpc';

@GrpcMethod('GetUser')
async getUser(request: GetUserRequest): Promise<GetUserResponse> {
  const user = await this.userService.findById(request.id);

  if (!user) {
    throw GrpcException.notFound('User not found', { userId: request.id });
  }

  if (!this.hasPermission(request.requesterId, user.id)) {
    throw GrpcException.permissionDenied('Access denied');
  }

  return { user };
}
```

### Available Exception Types

All standard gRPC status codes:

```typescript
GrpcException.ok()               // 0
GrpcException.cancelled()        // 1
GrpcException.unknown()          // 2
GrpcException.invalidArgument()  // 3
GrpcException.deadlineExceeded() // 4
GrpcException.notFound()         // 5
GrpcException.alreadyExists()    // 6
GrpcException.permissionDenied() // 7
GrpcException.resourceExhausted()// 8
GrpcException.failedPrecondition()// 9
GrpcException.aborted()          // 10
GrpcException.outOfRange()       // 11
GrpcException.unimplemented()    // 12
GrpcException.internal()         // 13
GrpcException.unavailable()      // 14
GrpcException.dataLoss()         // 15
GrpcException.unauthenticated()  // 16
```

### Custom Exception Filter

Create a custom filter to handle errors globally:

```typescript
import { Catch, RpcExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { GrpcException } from 'nestjs-grpc';

@Catch()
export class CustomGrpcExceptionFilter implements RpcExceptionFilter<any> {
  catch(exception: any, host: ArgumentsHost): Observable<any> {
    if (exception instanceof GrpcException) {
      return throwError(() => ({
        code: exception.getCode(),
        message: exception.message,
        details: exception.getDetails(),
      }));
    }
    return throwError(() => ({
      code: 13, // INTERNAL
      message: 'Internal server error',
    }));
  }
}

// Register in module
@Module({
  imports: [GrpcModule.forProvider({ /* ... */ })],
  providers: [{ provide: APP_FILTER, useClass: CustomGrpcExceptionFilter }],
})
export class AppModule {}
```

---

## Configuration Reference

### Server Configuration

```typescript
GrpcModule.forProvider({
  // Required
  protoPath: './protos/service.proto',  // Proto file path (supports glob patterns)
  package: 'service',                   // Proto package name

  // Connection
  url: '0.0.0.0:50051',                // Listen address (default: localhost:50051)
  secure: false,                        // Enable TLS

  // TLS Certificates
  rootCerts?: Buffer,
  privateKey?: Buffer,
  certChain?: Buffer,

  // Message Limits
  maxSendMessageSize: 4 * 1024 * 1024,  // Default: 4MB
  maxReceiveMessageSize: 4 * 1024 * 1024,

  // Logging
  logging: {
    enabled: true,
    level: GrpcLogLevel.LOG,
    context: 'GrpcModule',
  },
})
```

### Client Configuration

```typescript
@GrpcService({
  // Required
  serviceName: 'ExternalService',       // Service name from proto
  package: 'external',                  // Proto package name
  url: 'external-service:50051',        // Service URL

  // Connection
  secure: false,                        // Enable TLS

  // Timeouts & Retries
  clientOptions: {
    timeout: 30000,       // Request timeout in ms (default: 30000)
    maxRetries: 3,        // Retry attempts (default: 3)
    retryDelay: 1000,     // Delay between retries in ms (default: 1000)
  },

  // Advanced gRPC channel options
  channelOptions: {
    'grpc.keepalive_time_ms': 120000,
    'grpc.max_concurrent_streams': 100,
  },
})
```

### Async Configuration

Use ConfigService for dynamic settings:

```typescript
@Module({
  imports: [
    GrpcModule.forProviderAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        protoPath: config.get('GRPC_PROTO_PATH'),
        package: config.get('GRPC_PACKAGE'),
        url: config.get('GRPC_URL'),
        logging: {
          enabled: config.get('GRPC_LOGGING_ENABLED') !== 'false',
          level: process.env.NODE_ENV === 'production' ? GrpcLogLevel.WARN : GrpcLogLevel.DEBUG,
        },
      }),
    }),
  ],
})
export class AppModule {}
```

---

## CLI Code Generation

Generate TypeScript types from proto files:

```bash
# Basic usage
npx nestjs-grpc generate --proto "./protos/**/*.proto" --output "./src/generated"

# Generate classes instead of interfaces
npx nestjs-grpc generate --classes

# Watch mode (regenerate on changes)
npx nestjs-grpc generate --watch

# Filter by package name
npx nestjs-grpc generate --package-filter "auth"

# Verbose output for debugging
npx nestjs-grpc generate --verbose
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --proto <pattern>` | Proto file path or glob pattern | `"./protos/**/*.proto"` |
| `-o, --output <dir>` | Output directory | `"./src/generated"` |
| `-w, --watch` | Watch mode | `false` |
| `-c, --classes` | Generate classes instead of interfaces | `false` |
| `-f, --package-filter <name>` | Filter by package name | - |
| `-r, --recursive` | Search directories recursively | `true` |
| `-v, --verbose` | Verbose logging | `false` |

---

## Testing

### Testing Controllers

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GrpcModule } from 'nestjs-grpc';
import { AuthController } from './auth.controller';

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
      providers: [{
        provide: AuthService,
        useValue: {
          validateToken: jest.fn(),
          generateToken: jest.fn(),
        },
      }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should validate token successfully', async () => {
    jest.spyOn(authService, 'validateToken').mockResolvedValue(true);
    const result = await controller.validateToken({ token: 'valid-token' });
    expect(result.valid).toBe(true);
  });
});
```

### Testing Streaming

```typescript
import { Subject } from 'rxjs';

it('should handle server streaming', async () => {
  const mockStream = new Subject<User>();
  jest.spyOn(grpcClient, 'serverStream').mockReturnValue(mockStream);

  const result$ = service.getUserStream(10);
  const emitted: User[] = [];
  result$.subscribe(user => emitted.push(user));

  mockStream.next({ id: '1', name: 'John', email: 'john@example.com' });
  mockStream.complete();

  expect(emitted).toHaveLength(1);
});
```

---

## Logging

Configure logging using `GrpcLogLevel` enum:

```typescript
logging: {
  enabled: true,
  level: GrpcLogLevel.DEBUG,  // DEBUG | VERBOSE | LOG | WARN | ERROR
  context: 'GrpcModule',
}
```

Environment-based logging:

```typescript
logging: {
  enabled: config.get('GRPC_LOGGING_ENABLED') !== 'false',
  level: process.env.NODE_ENV === 'development'
    ? GrpcLogLevel.DEBUG
    : GrpcLogLevel.LOG,
}
```

---

## Performance Tips

### Connection Pooling

Clients are automatically pooled and reused with a 5-minute TTL:

```typescript
// No configuration needed - automatic connection management
```

### Message Size Optimization

Increase limits for larger payloads:

```typescript
GrpcModule.forProvider({
  // ...
  maxSendMessageSize: 16 * 1024 * 1024,    // 16MB
  maxReceiveMessageSize: 16 * 1024 * 1024,
})
```

### Retry Configuration

Enable retries with exponential backoff:

```typescript
const response = await this.grpcClient.call(
  'ServiceName',
  'MethodName',
  request,
  {
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 1000,  // Exponential: 1s → 2s → 4s
  }
);
```

---

## Troubleshooting

### Proto File Not Found

Ensure the path is correct and use absolute paths when possible:

```typescript
import path from 'path';

GrpcModule.forProvider({
  protoPath: path.join(__dirname, '../protos/service.proto'),
  package: 'service',
})
```

### Package Name Mismatch

The package name must match what's in your proto file:

```protobuf
// service.proto
package my.service;  // Must match configuration
```

```typescript
GrpcModule.forProvider({
  protoPath: './protos/service.proto',
  package: 'my.service',  // Matches proto file
})
```

### "12 UNIMPLEMENTED" Errors

Method is not registered. Check:
1. Controller decorator service name matches proto
2. Method decorator name matches proto exactly
3. Controller is in module's `controllers` array

```typescript
@GrpcController('ServiceName')  // Must match proto service
export class ServiceController {
  @GrpcMethod('MethodName')     // Must match proto method
  async methodName() {}
}
```

### Connection Refused

Check server is running and URL is correct:

```typescript
GrpcModule.forProvider({
  url: 'localhost:50051',  // Verify server is listening here
  logging: { level: GrpcLogLevel.DEBUG },  // Enable debug logs
})
```

---

## Real-World Example

See [BackendWorks/nestjs-microservices](https://github.com/BackendWorks/nestjs-microservices) for a complete working example of a microservices architecture using nestjs-grpc.

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

### Development Setup

```bash
git clone https://github.com/hmake98/nestjs-grpc.git
cd nestjs-grpc
npm install
npm run build
npm test
```

### Quality Standards

- **Test Coverage**: 99.87% statement coverage
- **TypeScript**: Strict type checking
- **Linting**: ESLint
- **Formatting**: Prettier

### Build Commands

```bash
npm run build        # Full production build (recommended)
npm run compile      # SWC compilation only (~31ms)
npm run declarations # Generate TypeScript declarations
npm test             # Run tests with coverage
npm run test:watch   # Watch mode
```

### Release Commands

```bash
npm run release:patch    # Patch version (1.2.3 → 1.2.4)
npm run release:minor    # Minor version (1.2.3 → 1.3.0)
npm run release:major    # Major version (1.2.3 → 2.0.0)
npm run release:beta     # Beta release
npm run release:rc       # Release candidate
```

---

## Changelog

### v1.5.0 (Latest)

**✨ Features**
- 99.87% statement coverage across core modules
- Advanced error handling and streaming tests
- SWC compiler integration (31ms vs 500ms+ with TypeScript)

**🐛 Fixes**
- Fixed streaming error paths in all patterns
- Resolved exception filter edge cases
- Improved proto file loading error handling

**📈 Performance**
- Lightning-fast SWC compilation
- Optimized connection pooling
- Enhanced retry logic with exponential backoff

**🔧 Breaking Changes**
- Removed automatic global exception filter
- Updated logging system to use GrpcLogLevel enum (removed deprecated options)
- ts-jest replaced with @swc/jest for faster tests

For complete changelog, see [GitHub Releases](https://github.com/hmake98/nestjs-grpc/releases).

---

## Links

- [GitHub Repository](https://github.com/hmake98/nestjs-grpc)
- [npm Package](https://www.npmjs.com/package/nestjs-grpc)
- [gRPC Documentation](https://grpc.io/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Protocol Buffers Guide](https://developers.google.com/protocol-buffers)

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Support

- [GitHub Issues](https://github.com/hmake98/nestjs-grpc/issues) - Bug reports & features
- [GitHub Discussions](https://github.com/hmake98/nestjs-grpc/discussions) - Community support

---

**Made with ❤️ for the NestJS community**

⭐ Star us on GitHub if this package helped you!
