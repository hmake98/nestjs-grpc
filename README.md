# nestjs-grpc

<div align="center">

[![npm version](https://badge.fury.io/js/nestjs-grpc.svg)](https://badge.fury.io/js/nestjs-grpc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)

**Production-ready NestJS package for type-safe gRPC microservices**

[Quick Start](#-quick-start) • [Documentation](#-documentation) • [Examples](#-examples) • [API Reference](#-api-reference)

</div>

## ✨ Features

- 🚀 **Easy Integration** - Seamless NestJS integration with decorators
- 🛡️ **Type Safety** - Full TypeScript support with auto-generated types
- 🔄 **Streaming Support** - All gRPC streaming patterns (unary, server, client, bidirectional)
- ⚡ **High Performance** - Optimized for production with connection pooling
- 🛠️ **CLI Tools** - Generate TypeScript types from proto files
- 🔒 **Secure** - Built-in TLS support and authentication helpers
- 📊 **Observability** - Request/response logging and error handling
- 🧪 **Testing Friendly** - Easy mocking and testing utilities

## 🚀 Quick Start

### Installation

```bash
npm install nestjs-grpc
```

### 1. Create Proto File

```protobuf
// protos/user.proto
syntax = "proto3";
package user;

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
}

message GetUserRequest { string id = 1; }
message CreateUserRequest { string name = 1; string email = 2; }
message ListUsersRequest { int32 limit = 1; }
message User { string id = 1; string name = 2; string email = 3; }
```

### 2. Generate Types

```bash
npx nestjs-grpc generate --proto ./protos --output ./src/generated
```

### 3. Setup Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';

@Module({
  imports: [
    GrpcModule.forRoot({
      protoPath: './protos/user.proto',
      package: 'user',
    }),
  ],
})
export class AppModule {}
```

### 4. Implement Service

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod } from 'nestjs-grpc';
import { Observable, interval } from 'rxjs';
import { map, take } from 'rxjs/operators';

@Controller()
@GrpcService('UserService')
export class UserController {
  private users = [
    { id: '1', name: 'John', email: 'john@example.com' },
    { id: '2', name: 'Jane', email: 'jane@example.com' },
  ];

  @GrpcMethod('GetUser')
  getUser(request: { id: string }) {
    const user = this.users.find(u => u.id === request.id);
    if (!user) throw GrpcException.notFound('User not found');
    return user;
  }

  @GrpcMethod('CreateUser')
  createUser(request: { name: string; email: string }) {
    const user = { id: Date.now().toString(), ...request };
    this.users.push(user);
    return user;
  }

  @GrpcMethod({ methodName: 'ListUsers', streaming: true })
  listUsers(): Observable<any> {
    return interval(1000).pipe(
      take(this.users.length),
      map(i => this.users[i])
    );
  }
}
```

### 5. Use Client

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';

@Injectable()
export class UserService implements OnModuleInit {
  private client: any;

  constructor(private grpcClient: GrpcClientService) {}

  onModuleInit() {
    this.client = this.grpcClient.create('UserService');
  }

  async getUser(id: string) {
    return this.client.getUser({ id });
  }

  async createUser(name: string, email: string) {
    return this.client.createUser({ name, email });
  }

  streamUsers() {
    return this.client.listUsers({});
  }
}
```

## 📖 Documentation

### Module Configuration

#### Basic Setup

```typescript
import { GrpcModule } from 'nestjs-grpc';

GrpcModule.forRoot({
  protoPath: './protos/service.proto',
  package: 'service',
  url: 'localhost:50051', // optional, defaults to localhost:50051
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

#### Multiple Proto Files

```typescript
// Directory with multiple proto files
GrpcModule.forRoot({
  protoPath: './protos/',
  package: 'app',
})

// Glob pattern
GrpcModule.forRoot({
  protoPath: './protos/**/*.proto',
  package: 'app',
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

### Service Implementation

#### Basic Service

```typescript
@Controller()
@GrpcService('UserService')
export class UserController {
  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest): Promise<User> {
    // Your logic here
    return { id: request.id, name: 'John', email: 'john@example.com' };
  }
}
```

#### With Validation

```typescript
import { GrpcException } from 'nestjs-grpc';

@GrpcMethod('CreateUser')
async createUser(request: CreateUserRequest): Promise<User> {
  if (!request.name) {
    throw GrpcException.invalidArgument('Name is required');
  }

  if (!request.email.includes('@')) {
    throw GrpcException.invalidArgument('Invalid email format');
  }

  // Create user logic
  return this.userService.create(request);
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

### Client Usage

#### Basic Client

```typescript
@Injectable()
export class UserService implements OnModuleInit {
  private userClient: any;

  constructor(private grpcClient: GrpcClientService) {}

  onModuleInit() {
    this.userClient = this.grpcClient.create('UserService');
  }

  async getUser(id: string) {
    return this.userClient.getUser({ id });
  }
}
```

#### With Custom Options

```typescript
onModuleInit() {
  this.userClient = this.grpcClient.create('UserService', {
    url: 'user-service:50051',
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 1000,
  });
}
```

#### With Metadata

```typescript
import { Metadata } from '@grpc/grpc-js';

async getUser(id: string, token: string) {
  const metadata = new Metadata();
  metadata.add('authorization', `Bearer ${token}`);

  return this.userClient.getUser({ id }, metadata);
}
```

### Error Handling

#### Throwing Errors

```typescript
import { GrpcException, GrpcErrorCode } from 'nestjs-grpc';

// Using helper methods
throw GrpcException.notFound('User not found');
throw GrpcException.invalidArgument('Invalid email');
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

// Generated service interface
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
@Controller()
@GrpcService('OrderService')
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

### Authentication Service

```typescript
// auth.controller.ts
@Controller()
@GrpcService('AuthService')
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
@Controller()
@GrpcService('ChatService')
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

### 1. Error Handling

```typescript
// ✅ Good: Use specific error codes
throw GrpcException.invalidArgument('Email is required');

// ❌ Bad: Generic errors
throw new Error('Something went wrong');
```

### 2. Validation

```typescript
// ✅ Good: Validate early
@GrpcMethod('CreateUser')
async createUser(request: CreateUserRequest): Promise<User> {
  if (!request.name?.trim()) {
    throw GrpcException.invalidArgument('Name is required');
  }
  // ... rest of logic
}
```

### 3. Timeout Configuration

```typescript
// ✅ Good: Set appropriate timeouts
this.client = this.grpcClient.create('UserService', {
  timeout: 5000, // 5 seconds for user operations
  maxRetries: 3,
  retryDelay: 1000,
});
```

### 4. Resource Cleanup

```typescript
// ✅ Good: Cleanup streams
export class ChatService implements OnModuleDestroy {
  private subscriptions = new Map<string, Subscription>();

  onModuleDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();
  }
}
```

### 5. Testing

```typescript
// ✅ Good: Mock gRPC clients
const mockClient = {
  getUser: jest.fn().mockResolvedValue({ id: '1', name: 'John' }),
};

jest.spyOn(grpcClientService, 'create').mockReturnValue(mockClient);
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

#### 2. Package Not Found

```
Error: Package 'user' not found
```

**Solution:**
- Verify package name in proto file matches configuration
- Check proto syntax: `syntax = "proto3";`

#### 3. Service Not Found

```
Error: Service 'UserService' not found
```

**Solution:**
- Ensure service name matches proto definition
- Check package prefix: try `'user.UserService'`

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
console.log('gRPC Client created:', client);
console.log('Request:', request);
console.log('Response:', response);
```

## 📊 Performance Tips

### 1. Connection Pooling

```typescript
// ✅ Reuse clients
@Injectable()
export class UserService implements OnModuleInit {
  private client: any; // Reused across requests

  onModuleInit() {
    this.client = this.grpcClient.create('UserService');
  }
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

### Module

```typescript
interface GrpcOptions {
  protoPath: string;           // Proto file path
  package: string;             // Proto package name
  url?: string;                // Server URL (default: 'localhost:50051')
  secure?: boolean;            // Use TLS (default: false)
  maxSendMessageSize?: number; // Max send size (default: 4MB)
  maxReceiveMessageSize?: number; // Max receive size (default: 4MB)
  // ... additional options
}
```

### Decorators

```typescript
@GrpcService(serviceName: string)
@GrpcMethod(methodName?: string)
@GrpcMethod(options: { methodName?: string; streaming?: boolean })
```

### Client

```typescript
interface GrpcClientOptions {
  service: string;      // Service name
  url?: string;         // Override URL
  timeout?: number;     // Request timeout (default: 30000ms)
  maxRetries?: number;  // Max retries (default: 3)
  retryDelay?: number;  // Retry delay (default: 1000ms)
  // ... additional options
}
```

### Exceptions

```typescript
// Static methods
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
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  UNAUTHENTICATED = 16,
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