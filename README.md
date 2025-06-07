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
- 🛡️ **Type Safety** - Full TypeScript support with auto-generated types
- 🔄 **Streaming Support** - All gRPC streaming patterns (unary, server, client, bidirectional)
- ⚡ **High Performance** - Optimized for production with connection pooling
- 🛠️ **CLI Tools** - Generate TypeScript types from proto files
- 🔒 **Secure** - Built-in TLS support and authentication helpers
- 📊 **Observability** - Request/response logging and error handling
- 🧪 **Testing Friendly** - Easy mocking and testing utilities
- 🏗️ **Modular** - Feature modules with `forFeature()` support
- 🔌 **Dependency Injection** - Full DI support for controllers and clients

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
  rpc Login(LoginRequest) returns (LoginResponse);
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
  rpc StreamUsers(StreamUsersRequest) returns (stream User);
}

message LoginRequest { string email = 1; string password = 2; }
message LoginResponse { string token = 1; User user = 2; }
message ValidateTokenRequest { string token = 1; }
message ValidateTokenResponse { bool valid = 1; User user = 2; }
message StreamUsersRequest { string filter = 1; }
message User { string id = 1; string name = 2; string email = 3; }
```

### 2. Generate Types

```bash
npx nestjs-grpc generate --proto ./protos --output ./src/generated
```

### 3. Setup App Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // Global gRPC configuration
    GrpcModule.forRoot({
      protoPath: './protos/auth.proto',
      package: 'auth',
      url: 'localhost:50051',
    }),
    AuthModule,
  ],
})
export class AppModule {}
```

### 4. Implement Server Controller

```typescript
// auth/auth.controller.ts
import { Controller, Injectable } from '@nestjs/common';
import { GrpcController, GrpcMethod, GrpcException } from 'nestjs-grpc';
import { Observable } from 'rxjs';

@GrpcController('AuthService')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('Login')
  async login(request: LoginRequest): Promise<LoginResponse> {
    const user = await this.authService.validateUser(request.email, request.password);

    if (!user) {
      throw GrpcException.unauthenticated('Invalid credentials');
    }

    const token = await this.authService.generateToken(user);
    return { token, user };
  }

  @GrpcMethod('ValidateToken')
  async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    try {
      const user = await this.authService.validateToken(request.token);
      return { valid: true, user };
    } catch {
      return { valid: false };
    }
  }

  @GrpcMethod({ methodName: 'StreamUsers', streaming: true })
  streamUsers(request: StreamUsersRequest): Observable<User> {
    return this.authService.getUserStream(request.filter);
  }
}
```

### 5. Create Client Service

```typescript
// auth/auth-client.service.ts
import { Injectable } from '@nestjs/common';
import { GrpcService } from 'nestjs-grpc';
import { Observable } from 'rxjs';

@GrpcService('AuthService')
export class AuthClientService {
  // Methods are auto-populated by the gRPC client
  login: (request: LoginRequest) => Promise<LoginResponse>;
  validateToken: (request: ValidateTokenRequest) => Promise<ValidateTokenResponse>;
  streamUsers: (request: StreamUsersRequest) => Observable<User>;
}
```

### 6. Feature Module Setup

```typescript
// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthClientService } from './auth-client.service';

@Module({
  imports: [
    GrpcModule.forFeature({
      controllers: [AuthController], // Server-side handlers
      services: [AuthClientService], // Client-side services
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthClientService], // Export for other modules
})
export class AuthModule {}
```

### 7. Using Client in Another Service

```typescript
// user/user.service.ts
import { Injectable } from '@nestjs/common';
import { AuthClientService } from '../auth/auth-client.service';

@Injectable()
export class UserService {
  constructor(private readonly authClient: AuthClientService) {}

  async authenticateUser(email: string, password: string) {
    try {
      const response = await this.authClient.login({ email, password });
      return response;
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  streamUsers(filter: string) {
    return this.authClient.streamUsers({ filter });
  }
}
```

## 📖 Documentation

### Module Configuration

#### Basic Setup

```typescript
import { GrpcModule } from 'nestjs-grpc';

// Global configuration
GrpcModule.forRoot({
  protoPath: './protos/service.proto',
  package: 'service',
  url: 'localhost:50051',
})
```

#### Async Configuration

```typescript
GrpcModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    protoPath: config.get('PROTO_PATH'),
    package: config.get('GRPC_PACKAGE'),
    url: config.get('GRPC_URL'),
    secure: config.get('GRPC_SECURE') === 'true',
  }),
})
```

#### Production Configuration

```typescript
import { readFileSync } from 'fs';

GrpcModule.forRoot({
  protoPath: './protos/service.proto',
  package: 'service',
  url: 'api.example.com:443',
  secure: true,
  rootCerts: readFileSync('./certs/ca.crt'),
  maxSendMessageSize: 10 * 1024 * 1024, // 10MB
  maxReceiveMessageSize: 10 * 1024 * 1024, // 10MB
})
```

### Server-Side Implementation

#### Controller Definition

```typescript
@GrpcController('UserService')
export class UserController {
  constructor(private userService: UserService) {}

  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest): Promise<User> {
    return this.userService.findById(request.id);
  }

  @GrpcMethod('CreateUser')
  async createUser(request: CreateUserRequest): Promise<User> {
    if (!request.name) {
      throw GrpcException.invalidArgument('Name is required');
    }
    return this.userService.create(request);
  }

  @GrpcMethod({ methodName: 'StreamUsers', streaming: true })
  streamUsers(request: StreamUsersRequest): Observable<User> {
    return this.userService.getUserStream(request.filter);
  }
}
```

#### With Metadata

```typescript
import { Metadata } from '@grpc/grpc-js';

@GrpcMethod('GetUser')
async getUser(request: GetUserRequest, metadata: Metadata): Promise<User> {
  const token = metadata.get('authorization')[0];

  if (!token) {
    throw GrpcException.unauthenticated('Missing auth token');
  }

  const user = await this.authService.validateToken(token.toString());
  return this.userService.findById(request.id, user);
}
```

### Client-Side Implementation

#### Service Class Approach

```typescript
@GrpcService('UserService')
export class UserClientService {
  // Auto-populated methods
  getUser: (request: GetUserRequest) => Promise<User>;
  createUser: (request: CreateUserRequest) => Promise<User>;
  streamUsers: (request: StreamUsersRequest) => Observable<User>;
}

// Usage
@Injectable()
export class AppService {
  constructor(private userClient: UserClientService) {}

  async getUser(id: string) {
    return this.userClient.getUser({ id });
  }
}
```

#### Injection Token Approach

```typescript
import { InjectGrpcClient } from 'nestjs-grpc';

@Injectable()
export class AppService {
  constructor(
    @InjectGrpcClient('UserService') private userClient: any,
    @InjectGrpcClient('AuthService') private authClient: any,
  ) {}

  async getUser(id: string) {
    return this.userClient.getUser({ id });
  }
}
```

#### With Custom Configuration

```typescript
@GrpcService({
  serviceName: 'UserService',
  url: 'user-service:50051', // Custom URL
  clientOptions: {
    timeout: 10000, // 10 second timeout
    maxRetries: 5,
    secure: true,
  },
})
export class CustomUserClientService {
  // Methods auto-populated
}
```

### Error Handling

#### Throwing Errors

```typescript
import { GrpcException, GrpcErrorCode } from 'nestjs-grpc';

// Using helper methods
throw GrpcException.notFound('User not found');
throw GrpcException.invalidArgument('Invalid email format');
throw GrpcException.permissionDenied('Access denied');

// Custom error
throw new GrpcException({
  code: GrpcErrorCode.INVALID_ARGUMENT,
  message: 'Validation failed',
  details: { field: 'email', reason: 'format' },
  metadata: { 'retry-after': '60' },
});
```

#### Handling Client Errors

```typescript
try {
  const user = await this.userClient.getUser({ id });
  return user;
} catch (error) {
  if (error.code === 5) { // NOT_FOUND
    throw new NotFoundException('User not found');
  }
  if (error.code === 3) { // INVALID_ARGUMENT
    throw new BadRequestException(error.message);
  }
  throw new InternalServerErrorException('Service error');
}
```

### Streaming

#### Server Streaming

```typescript
@GrpcMethod({ methodName: 'StreamUsers', streaming: true })
streamUsers(request: StreamUsersRequest): Observable<User> {
  return interval(1000).pipe(
    take(10),
    map(i => ({ id: i.toString(), name: `User ${i}` }))
  );
}

// Client usage
this.userClient.streamUsers({}).subscribe(user => {
  console.log('Received user:', user);
});
```

#### Client Streaming

```typescript
@GrpcMethod('BulkCreateUsers')
async bulkCreateUsers(users: Observable<CreateUserRequest>): Promise<BulkCreateResponse> {
  const createdUsers = [];

  return new Promise((resolve) => {
    users.subscribe({
      next: (user) => createdUsers.push(this.createUser(user)),
      complete: () => resolve({ count: createdUsers.length }),
    });
  });
}

// Client usage
const userStream = new Subject<CreateUserRequest>();
const response = this.userClient.bulkCreateUsers(userStream);

userStream.next({ name: 'John', email: 'john@example.com' });
userStream.next({ name: 'Jane', email: 'jane@example.com' });
userStream.complete();
```

#### Bidirectional Streaming

```typescript
@GrpcMethod({ methodName: 'Chat', streaming: true })
chat(messages: Observable<ChatMessage>): Observable<ChatMessage> {
  return messages.pipe(
    map(msg => ({
      ...msg,
      content: `Echo: ${msg.content}`,
      timestamp: Date.now(),
    }))
  );
}

// Client usage
const messageStream = new Subject<ChatMessage>();
const responseStream = this.chatClient.chat(messageStream);

responseStream.subscribe(msg => console.log('Received:', msg));
messageStream.next({ content: 'Hello!' });
```

## 🛠️ Type Generation

### CLI Usage

```bash
# Generate from single file
npx nestjs-grpc generate --proto ./user.proto --output ./src/generated

# Generate from directory
npx nestjs-grpc generate --proto ./protos/ --output ./src/generated

# Generate with options
npx nestjs-grpc generate \
  --proto "./protos/**/*.proto" \
  --output ./src/generated \
  --classes \
  --verbose
```

### CLI Options

| Option                   | Description                            | Default           |
| ------------------------ | -------------------------------------- | ----------------- |
| `--proto, -p`            | Proto file/directory/glob pattern      | Required          |
| `--output, -o`           | Output directory                       | `./src/generated` |
| `--classes, -c`          | Generate classes instead of interfaces | `false`           |
| `--comments`             | Include comments                       | `true`            |
| `--package-filter`       | Filter by package name                 | None              |
| `--no-client-interfaces` | Skip client interfaces                 | `false`           |
| `--verbose, -v`          | Verbose output                         | `false`           |
| `--silent, -s`           | Silent mode                            | `false`           |

### Generated Output

```typescript
// Generated interfaces
export interface User {
  id?: string;
  name?: string;
  email?: string;
}

export interface GetUserRequest {
  id?: string;
}

// Generated client interface
export interface UserServiceClient {
  getUser(request: GetUserRequest, metadata?: Metadata): Promise<User>;
  createUser(request: CreateUserRequest, metadata?: Metadata): Promise<User>;
  streamUsers(request: StreamUsersRequest, metadata?: Metadata): Observable<User>;
}

// Generated controller interface
export interface UserServiceInterface {
  getUser(request: GetUserRequest): Promise<User> | Observable<User>;
  createUser(request: CreateUserRequest): Promise<User> | Observable<User>;
  streamUsers(request: StreamUsersRequest): Observable<User>;
}
```

## 💡 Examples

### E-commerce Microservice

```typescript
// order.proto
service OrderService {
  rpc CreateOrder(CreateOrderRequest) returns (Order);
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc TrackOrder(TrackOrderRequest) returns (stream OrderStatus);
}

// order.controller.ts
@GrpcController('OrderService')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @GrpcMethod('CreateOrder')
  async createOrder(request: CreateOrderRequest): Promise<Order> {
    const order = await this.orderService.create(request);
    return order;
  }

  @GrpcMethod({ methodName: 'TrackOrder', streaming: true })
  trackOrder(request: TrackOrderRequest): Observable<OrderStatus> {
    return this.orderService.trackOrderUpdates(request.orderId);
  }
}
```

### Authentication Microservice

```typescript
// auth.controller.ts
@GrpcController('AuthService')
export class AuthController {
  @GrpcMethod('Login')
  async login(request: LoginRequest): Promise<LoginResponse> {
    const user = await this.authService.validateUser(request.email, request.password);

    if (!user) {
      throw GrpcException.unauthenticated('Invalid credentials');
    }

    const token = await this.authService.generateToken(user);
    return { token, user };
  }

  @GrpcMethod('ValidateToken')
  async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    try {
      const user = await this.authService.validateToken(request.token);
      return { valid: true, user };
    } catch {
      return { valid: false };
    }
  }
}
```

### Real-time Chat

```typescript
// chat.controller.ts
@GrpcController('ChatService')
export class ChatController {
  private rooms = new Map<string, Subject<ChatMessage>>();

  @GrpcMethod('SendMessage')
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const message = {
      id: uuid(),
      roomId: request.roomId,
      userId: request.userId,
      content: request.content,
      timestamp: Date.now(),
    };

    // Broadcast to room subscribers
    const roomSubject = this.getRoomSubject(request.roomId);
    roomSubject.next(message);

    return { messageId: message.id, success: true };
  }

  @GrpcMethod({ methodName: 'JoinRoom', streaming: true })
  joinRoom(request: JoinRoomRequest): Observable<ChatMessage> {
    return this.getRoomSubject(request.roomId).asObservable();
  }

  private getRoomSubject(roomId: string): Subject<ChatMessage> {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Subject<ChatMessage>());
    }
    return this.rooms.get(roomId);
  }
}
```

## 🔧 Best Practices

### 1. Module Organization

```typescript
// Organize by feature
src/
├── auth/
│   ├── auth.controller.ts      # @GrpcController
│   ├── auth.service.ts         # Business logic
│   ├── auth-client.service.ts  # @GrpcService
│   └── auth.module.ts          # GrpcModule.forFeature()
├── user/
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.module.ts
└── app.module.ts               # GrpcModule.forRoot()
```

### 2. Error Handling

```typescript
// ✅ Good: Use specific error codes
throw GrpcException.invalidArgument('Email is required');

// ❌ Bad: Generic errors
throw new Error('Something went wrong');
```

### 3. Validation

```typescript
// ✅ Good: Validate early
@GrpcMethod('CreateUser')
async createUser(request: CreateUserRequest): Promise<User> {
  if (!request.name?.trim()) {
    throw GrpcException.invalidArgument('Name is required');
  }
  if (!request.email?.includes('@')) {
    throw GrpcException.invalidArgument('Invalid email format');
  }
  // ... rest of logic
}
```

### 4. Configuration

```typescript
// ✅ Good: Environment-based config
GrpcModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    protoPath: config.get('GRPC_PROTO_PATH'),
    package: config.get('GRPC_PACKAGE'),
    url: config.get('GRPC_URL'),
    secure: config.get('NODE_ENV') === 'production',
  }),
})
```

### 5. Testing

```typescript
// ✅ Good: Mock gRPC clients
const mockAuthClient = {
  login: jest.fn().mockResolvedValue({ token: 'test', user: mockUser }),
  validateToken: jest.fn().mockResolvedValue({ valid: true, user: mockUser }),
};

const module = await Test.createTestingModule({
  providers: [
    UserService,
    { provide: AuthClientService, useValue: mockAuthClient },
  ],
}).compile();
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Proto File Not Found

```
Error: Proto file not found: ./protos/user.proto
```

**Solution:**
- Check file path is correct
- Use absolute paths: `join(__dirname, '../protos/user.proto')`
- Verify file permissions

#### 2. Service Not Found

```
Error: Service 'UserService' not found
```

**Solution:**
- Verify service name matches proto definition
- Check package prefix: try `'user.UserService'`
- Ensure controller has `@GrpcController` decorator

#### 3. Method Not Decorated

```
Error: Method must be decorated with @GrpcMethod
```

**Solution:**
- Add `@GrpcMethod()` to controller methods
- Verify method name matches proto definition

#### 4. Connection Failed

```
Error: 14 UNAVAILABLE: No connection established
```

**Solution:**
- Verify server is running
- Check URL format: `'localhost:50051'`
- Ensure firewall/network access

### Debugging

Enable verbose logging:

```typescript
// In development
GrpcModule.forRoot({
  // ... other options
  loaderOptions: {
    // Add debugging options
  }
})
```

## 📊 Performance Tips

### 1. Connection Reuse

```typescript
// ✅ Services automatically reuse connections
@GrpcService('UserService')
export class UserClientService {
  // Client is cached and reused
}
```

### 2. Message Size Limits

```typescript
GrpcModule.forRoot({
  maxSendMessageSize: 10 * 1024 * 1024, // 10MB
  maxReceiveMessageSize: 10 * 1024 * 1024, // 10MB
});
```

### 3. Streaming for Large Data

```typescript
// ✅ Use streaming for large datasets
@GrpcMethod({ methodName: 'GetAllUsers', streaming: true })
getAllUsers(): Observable<User> {
  return from(this.userRepository.findAll()).pipe(
    mergeMap(users => from(users))
  );
}
```

## 🔍 API Reference

### Decorators

```typescript
// Controller decorator
@GrpcController(serviceName: string | GrpcControllerOptions)

// Method decorator
@GrpcMethod(methodName?: string | GrpcMethodOptions)

// Service decorator
@GrpcService(serviceName: string | GrpcServiceOptions)

// Injection decorator
@InjectGrpcClient(serviceName: string)
```

### Interfaces

```typescript
interface GrpcOptions {
  protoPath: string;
  package: string;
  url?: string;
  secure?: boolean;
  maxSendMessageSize?: number;
  maxReceiveMessageSize?: number;
  // ... additional options
}

interface GrpcControllerOptions {
  serviceName: string;
  package?: string;
  url?: string;
}

interface GrpcServiceOptions {
  serviceName: string;
  package?: string;
  url?: string;
  clientOptions?: Partial<GrpcClientOptions>;
}
```

### Module Methods

```typescript
// Static configuration
GrpcModule.forRoot(options: GrpcOptions)

// Async configuration
GrpcModule.forRootAsync(options: GrpcModuleAsyncOptions)

// Feature module
GrpcModule.forFeature(options: { controllers?, services? })
```

### Exceptions

```typescript
// Error creation
GrpcException.notFound(message, details?, metadata?)
GrpcException.invalidArgument(message, details?, metadata?)
GrpcException.permissionDenied(message, details?, metadata?)
GrpcException.internal(message, details?, metadata?)
GrpcException.unauthenticated(message, details?, metadata?)

// Error codes
enum GrpcErrorCode {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  // ... all gRPC status codes
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/your-repo/nestjs-grpc.git
cd nestjs-grpc
npm install
npm run build
npm test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [gRPC Official Documentation](https://grpc.io/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Protocol Buffers](https://developers.google.com/protocol-buffers)

---

<div align="center">

Made with ❤️ for the NestJS community

⭐ Star us on GitHub if this package helped you!

</div>