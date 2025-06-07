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
- 🏗️ **Enhanced Feature Modules** - Advanced `forFeature()` with full dependency injection
- 🔌 **Complete DI Support** - Inject any NestJS service into gRPC controllers and clients
- 🗃️ **Database Integration** - Seamless TypeORM, Prisma, and other ORM support
- ⚙️ **Configuration** - Built-in support for NestJS Config module

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
import { ConfigModule } from '@nestjs/config';
import { GrpcModule } from 'nestjs-grpc';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({ isGlobal: true }),

    // Global gRPC configuration
    GrpcModule.forRoot({
      protoPath: './protos/auth.proto',
      package: 'auth',
      url: 'localhost:50051',
    }),

    // Feature modules
    AuthModule,
  ],
})
export class AppModule {}
```

### 4. Enhanced Feature Module with Full Dependency Injection

```typescript
// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GrpcModule } from 'nestjs-grpc';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthClientService } from './auth-client.service';
import { UserClientService } from '../user/user-client.service';
import { AuthEntity } from './entities/auth.entity';

@Module({
  imports: [
    // Required modules for dependencies
    TypeOrmModule.forFeature([AuthEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),

    // Enhanced gRPC feature configuration
    GrpcModule.forFeature({
      controllers: [AuthController],           // Server-side handlers
      services: [AuthClientService, UserClientService], // Client-side services
      providers: [
        AuthService,                          // Business logic
        {
          provide: 'AUTH_CONFIG',
          useFactory: (config: ConfigService) => ({
            maxLoginAttempts: config.get('MAX_LOGIN_ATTEMPTS', 5),
            lockoutDuration: config.get('LOCKOUT_DURATION', 300000),
          }),
          inject: [ConfigService],
        },
      ],
      exports: [AuthClientService, AuthService], // Export for other modules
    }),
  ],
})
export class AuthModule {}
```

### 5. Controller with Full Dependency Injection

```typescript
// auth/auth.controller.ts
import { Controller, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { GrpcController, GrpcMethod, GrpcException } from 'nestjs-grpc';
import { Observable } from 'rxjs';

import { AuthEntity } from './entities/auth.entity';
import { AuthService } from './auth.service';
import { UserClientService } from '../user/user-client.service';

@GrpcController('AuthService')
export class AuthController {
  constructor(
    // ✅ Inject TypeORM repositories
    @InjectRepository(AuthEntity)
    private readonly authRepository: Repository<AuthEntity>,

    // ✅ Inject NestJS services
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,

    // ✅ Inject gRPC client services
    private readonly userClient: UserClientService,

    // ✅ Inject custom configuration
    @Inject('AUTH_CONFIG')
    private readonly authConfig: any,
  ) {}

  @GrpcMethod('Login')
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      // Validate input
      if (!request.email || !request.password) {
        throw GrpcException.invalidArgument('Email and password are required');
      }

      // Use gRPC client to get user data
      const user = await this.userClient.getUserByEmail({ email: request.email });

      if (!user) {
        throw GrpcException.unauthenticated('Invalid credentials');
      }

      // Check account lockout using database
      const authRecord = await this.authRepository.findOne({
        where: { userId: user.id },
      });

      if (authRecord && this.authService.isAccountLocked(authRecord, this.authConfig)) {
        throw GrpcException.failedPrecondition('Account is locked');
      }

      // Validate password and generate JWT token
      const isValid = await this.authService.validatePassword(request.password, user.passwordHash);

      if (!isValid) {
        await this.authService.recordFailedLogin(user.id);
        throw GrpcException.unauthenticated('Invalid credentials');
      }

      // Generate token using injected JWT service
      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
      });

      return { token, user };
    } catch (error) {
      if (error instanceof GrpcException) {
        throw error;
      }
      throw GrpcException.internal(`Login failed: ${error.message}`);
    }
  }

  @GrpcMethod('ValidateToken')
  async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    try {
      // Use injected JWT service
      const payload = this.jwtService.verify(request.token);

      // Use gRPC client to get user
      const user = await this.userClient.getUser({ id: payload.sub });

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

### 6. Client Service with Auto-Population

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

### Enhanced Feature Module Configuration

#### Basic Feature Module

```typescript
import { GrpcModule } from 'nestjs-grpc';

// Simple feature module
GrpcModule.forFeature({
  controllers: [AuthController],
  services: [AuthClientService],
})
```

#### Advanced Feature Module with Dependencies

```typescript
import { GrpcModule, GrpcFeatureOptions } from 'nestjs-grpc';

// Full feature module with dependencies
GrpcModule.forFeature({
  controllers: [OrderController],
  services: [PaymentClientService, InventoryClientService],
  providers: [
    OrderService,
    EmailService,
    {
      provide: 'ORDER_CONFIG',
      useFactory: (config: ConfigService) => ({
        timeout: config.get('ORDER_TIMEOUT', 30000),
      }),
      inject: [ConfigService],
    },
  ],
  imports: [
    TypeOrmModule.forFeature([OrderEntity]),
    HttpModule,
  ],
  exports: [OrderService],
} as GrpcFeatureOptions)
```

#### Multi-Service Integration Example

```typescript
// Complex microservice with multiple dependencies
@Module({
  imports: [
    // Database
    TypeOrmModule.forFeature([OrderEntity, PaymentEntity]),

    // External modules
    HttpModule,
    ConfigModule,

    // gRPC Feature
    GrpcModule.forFeature({
      controllers: [OrderController],
      services: [
        PaymentClientService,    // Payment microservice
        InventoryClientService, // Inventory microservice
        UserClientService,      // User microservice
        NotificationClientService, // Notification microservice
      ],
      providers: [
        OrderService,
        PaymentService,
        InventoryService,
        {
          provide: 'PAYMENT_CONFIG',
          useValue: { timeout: 10000 },
        },
      ],
      exports: [OrderService],
    }),
  ],
})
export class OrderModule {}
```

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

#### Controller with Database Integration

```typescript
@GrpcController('UserService')
export class UserController {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: request.id },
    });

    if (!user) {
      throw GrpcException.notFound('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  @GrpcMethod('CreateUser')
  async createUser(request: CreateUserRequest): Promise<User> {
    // Validation
    if (!request.name?.trim()) {
      throw GrpcException.invalidArgument('Name is required');
    }

    if (!request.email?.includes('@')) {
      throw GrpcException.invalidArgument('Invalid email format');
    }

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email: request.email },
    });

    if (existingUser) {
      throw GrpcException.alreadyExists('User with this email already exists');
    }

    // Create user
    const user = this.userRepository.create({
      name: request.name,
      email: request.email,
      createdAt: new Date(),
    });

    const savedUser = await this.userRepository.save(user);

    // Send welcome email using injected service
    await this.emailService.sendWelcomeEmail(savedUser.email, savedUser.name);

    return {
      id: savedUser.id,
      name: savedUser.name,
      email: savedUser.email,
    };
  }

  @GrpcMethod({ methodName: 'StreamUsers', streaming: true })
  streamUsers(request: StreamUsersRequest): Observable<User> {
    // Stream users from database
    return from(this.userRepository.find()).pipe(
      mergeMap(users => from(users)),
      map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
      }))
    );
  }
}
```

#### With Metadata and Authentication

```typescript
import { Metadata } from '@grpc/grpc-js';

@GrpcMethod('GetUser')
async getUser(request: GetUserRequest, metadata: Metadata): Promise<User> {
  const token = metadata.get('authorization')[0];

  if (!token) {
    throw GrpcException.unauthenticated('Missing auth token');
  }

  // Validate token using injected auth service
  const tokenData = await this.authService.validateToken(token.toString());

  if (!tokenData.valid) {
    throw GrpcException.unauthenticated('Invalid token');
  }

  return this.userService.findById(request.id, tokenData.user);
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

// Usage in another service
@Injectable()
export class ProfileService {
  constructor(
    private readonly userClient: UserClientService,
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
  ) {}

  async createProfile(userId: string, profileData: any) {
    // Get user via gRPC
    const user = await this.userClient.getUser({ id: userId });

    // Create profile in local database
    const profile = this.profileRepository.create({
      userId: user.id,
      ...profileData,
    });

    return this.profileRepository.save(profile);
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

// Custom error with details
throw new GrpcException({
  code: GrpcErrorCode.INVALID_ARGUMENT,
  message: 'Validation failed',
  details: {
    field: 'email',
    reason: 'format',
    provided: request.email
  },
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

### E-commerce Microservice with Full Integration

```typescript
// order/order.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderItemEntity]),
    ConfigModule,

    GrpcModule.forFeature({
      controllers: [OrderController],
      services: [
        PaymentClientService,
        InventoryClientService,
        UserClientService,
        NotificationClientService,
      ],
      providers: [
        OrderService,
        {
          provide: 'ORDER_CONFIG',
          useFactory: (config: ConfigService) => ({
            maxRetries: config.get('ORDER_MAX_RETRIES', 3),
            timeout: config.get('ORDER_TIMEOUT', 30000),
          }),
          inject: [ConfigService],
        },
      ],
    }),
  ],
})
export class OrderModule {}

// order/order.controller.ts
@GrpcController('OrderService')
export class OrderController {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    private readonly paymentClient: PaymentClientService,
    private readonly inventoryClient: InventoryClientService,
    private readonly userClient: UserClientService,
    private readonly notificationClient: NotificationClientService,
    @Inject('ORDER_CONFIG') private readonly orderConfig: any,
  ) {}

  @GrpcMethod('CreateOrder')
  async createOrder(request: CreateOrderRequest): Promise<Order> {
    // Get user
    const user = await this.userClient.getUser({ id: request.userId });

    // Check inventory
    const inventory = await this.inventoryClient.checkAvailability({
      productId: request.productId,
      quantity: request.quantity,
    });

    if (!inventory.available) {
      throw GrpcException.failedPrecondition('Product not available');
    }

    // Process payment
    const payment = await this.paymentClient.processPayment({
      amount: request.amount,
      currency: request.currency,
      userId: request.userId,
    });

    if (!payment.success) {
      throw GrpcException.failedPrecondition('Payment failed');
    }

    // Create order
    const order = this.orderRepository.create({
      userId: request.userId,
      productId: request.productId,
      quantity: request.quantity,
      amount: request.amount,
      paymentId: payment.paymentId,
      status: 'confirmed',
    });

    const savedOrder = await this.orderRepository.save(order);

    // Reserve inventory
    await this.inventoryClient.reserveItems({
      productId: request.productId,
      quantity: request.quantity,
      orderId: savedOrder.id,
    });

    // Send notification
    await this.notificationClient.sendOrderConfirmation({
      userId: request.userId,
      orderId: savedOrder.id,
    });

    return {
      id: savedOrder.id,
      userId: savedOrder.userId,
      productId: savedOrder.productId,
      quantity: savedOrder.quantity,
      amount: savedOrder.amount,
      status: savedOrder.status,
    };
  }

  @GrpcMethod({ methodName: 'TrackOrder', streaming: true })
  trackOrder(request: TrackOrderRequest): Observable<OrderStatus> {
    return this.orderService.trackOrderUpdates(request.orderId);
  }
}
```

### Authentication Microservice with JWT

```typescript
// auth/auth.controller.ts
@GrpcController('AuthService')
export class AuthController {
  constructor(
    @InjectRepository(AuthEntity)
    private readonly authRepository: Repository<AuthEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userClient: UserClientService,
  ) {}

  @GrpcMethod('Login')
  async login(request: LoginRequest): Promise<LoginResponse> {
    const user = await this.userClient.getUserByEmail({ email: request.email });

    if (!user) {
      throw GrpcException.unauthenticated('Invalid credentials');
    }

    // Check password (using bcrypt)
    const isValid = await bcrypt.compare(request.password, user.passwordHash);

    if (!isValid) {
      throw GrpcException.unauthenticated('Invalid credentials');
    }

    // Generate JWT
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return { token, user };
  }

  @GrpcMethod('ValidateToken')
  async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    try {
      const payload = this.jwtService.verify(request.token);
      const user = await this.userClient.getUser({ id: payload.sub });

      return { valid: true, user };
    } catch {
      return { valid: false };
    }
  }
}
```

### Real-time Chat with Database

```typescript
// chat/chat.controller.ts
@GrpcController('ChatService')
export class ChatController {
  private rooms = new Map<string, Subject<ChatMessage>>();

  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    private readonly userClient: UserClientService,
  ) {}

  @GrpcMethod('SendMessage')
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    // Validate user
    const user = await this.userClient.getUser({ id: request.userId });

    // Save message to database
    const message = this.messageRepository.create({
      id: uuid(),
      roomId: request.roomId,
      userId: request.userId,
      content: request.content,
      timestamp: new Date(),
    });

    const savedMessage = await this.messageRepository.save(message);

    // Broadcast to room subscribers
    const roomSubject = this.getRoomSubject(request.roomId);
    roomSubject.next({
      id: savedMessage.id,
      roomId: savedMessage.roomId,
      userId: savedMessage.userId,
      userName: user.name,
      content: savedMessage.content,
      timestamp: savedMessage.timestamp.getTime(),
    });

    return { messageId: savedMessage.id, success: true };
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
// Organize by feature with full dependency injection
src/
├── auth/
│   ├── auth.controller.ts      # @GrpcController with full DI
│   ├── auth.service.ts         # Business logic
│   ├── auth-client.service.ts  # @GrpcService
│   ├── entities/
│   │   └── auth.entity.ts      # TypeORM entity
│   └── auth.module.ts          # Enhanced GrpcModule.forFeature()
├── user/
│   ├── user.controller.ts
│   ├── user.service.ts
│   ├── user-client.service.ts
│   ├── entities/
│   │   └── user.entity.ts
│   └── user.module.ts
├── shared/
│   ├── services/
│   │   ├── email.service.ts
│   │   └── hash.service.ts
│   └── shared.module.ts
└── app.module.ts               # GrpcModule.forRoot()
```

### 2. Error Handling with Context

```typescript
// ✅ Good: Contextual error handling
@GrpcMethod('CreateUser')
async createUser(request: CreateUserRequest): Promise<User> {
  try {
    // Validation
    if (!request.name?.trim()) {
      throw GrpcException.invalidArgument('Name is required');
    }

    // Business logic with proper error context
    const existingUser = await this.userRepository.findOne({
      where: { email: request.email },
    });

    if (existingUser) {
      throw GrpcException.alreadyExists(
        'User with this email already exists',
        { email: request.email }
      );
    }

    return await this.userService.create(request);
  } catch (error) {
    if (error instanceof GrpcException) {
      throw error;
    }

    // Log the error for debugging
    this.logger.error('Failed to create user', error.stack);
    throw GrpcException.internal('Failed to create user');
  }
}
```

### 3. Configuration Management

```typescript
// ✅ Good: Centralized configuration
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    GrpcModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        protoPath: config.get('GRPC_PROTO_PATH'),
        package: config.get('GRPC_PACKAGE'),
        url: config.get('GRPC_URL'),
        secure: config.get('NODE_ENV') === 'production',
        maxSendMessageSize: config.get('GRPC_MAX_MESSAGE_SIZE', 4 * 1024 * 1024),
      }),
    }),
  ],
})
export class AppModule {}
```

### 4. Testing with Full DI Support

```typescript
// ✅ Good: Comprehensive testing setup
describe('AuthController', () => {
  let controller: AuthController;
  let userClient: UserClientService;
  let authRepository: Repository<AuthEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: getRepositoryToken(AuthEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: UserClientService,
          useValue: {
            getUserByEmail: jest.fn(),
            getUser: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: 'AUTH_CONFIG',
          useValue: {
            maxLoginAttempts: 5,
            lockoutDuration: 300000,
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    userClient = module.get<UserClientService>(UserClientService);
    authRepository = module.get<Repository<AuthEntity>>(getRepositoryToken(AuthEntity));
  });

  it('should authenticate user successfully', async () => {
    // Test with all dependencies properly mocked
    const mockUser = { id: '1', email: 'test@example.com', passwordHash: 'hash' };

    jest.spyOn(userClient, 'getUserByEmail').mockResolvedValue(mockUser);
    jest.spyOn(authRepository, 'findOne').mockResolvedValue(null);

    const result = await controller.login({
      email: 'test@example.com',
      password: 'password',
    });

    expect(result.token).toBeDefined();
    expect(result.user).toEqual(mockUser);
  });
});
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Dependency Injection Errors

```
Error: Nest can't resolve dependencies of AuthController
```

**Solution:**
- Ensure all dependencies are provided in the module
- Add required imports to the feature module
- Check that services are properly decorated

```typescript
// ✅ Fix: Provide all dependencies
GrpcModule.forFeature({
  controllers: [AuthController],
  services: [UserClientService],
  providers: [
    AuthService,              // ✅ Add missing service
    {
      provide: 'AUTH_CONFIG', // ✅ Add custom providers
      useValue: { ... },
    },
  ],
  imports: [
    TypeOrmModule.forFeature([AuthEntity]), // ✅ Add required imports
  ],
})
```

#### 2. Proto File Not Found

```
Error: Proto file not found: ./protos/user.proto
```

**Solution:**
- Check file path is correct
- Use absolute paths: `join(__dirname, '../protos/user.proto')`
- Verify file permissions

#### 3. Service Not Found

```
Error: Service 'UserService' not found
```

**Solution:**
- Verify service name matches proto definition
- Check package prefix: try `'user.UserService'`
- Ensure controller has `@GrpcController` decorator

#### 4. Connection Failed

```
Error: 14 UNAVAILABLE: No connection established
```

**Solution:**
- Verify server is running
- Check URL format: `'localhost:50051'`
- Ensure firewall/network access

#### 5. TypeORM Repository Not Found

```
Error: Please make sure that the argument at index [0] is available
```

**Solution:**
- Add TypeORM module import to feature module

```typescript
GrpcModule.forFeature({
  controllers: [UserController],
  imports: [
    TypeOrmModule.forFeature([UserEntity]), // ✅ Add this
  ],
})
```

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
  // Client is cached and reused across requests
}
```

### 2. Message Size Limits

```typescript
GrpcModule.forRoot({
  maxSendMessageSize: 10 * 1024 * 1024, // 10MB
  maxReceiveMessageSize: 10 * 1024 * 1024, // 10MB
});
```

### 3. Database Connection Pooling

```typescript
// Use proper connection pooling
TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  extra: {
    max: 20,              // Maximum connections
    min: 5,               // Minimum connections
    idleTimeoutMillis: 30000,
  },
})
```

### 4. Streaming for Large Data

```typescript
// ✅ Use streaming for large datasets
@GrpcMethod({ methodName: 'GetAllUsers', streaming: true })
getAllUsers(): Observable<User> {
  return from(this.userRepository.createQueryBuilder('user')
    .where('user.active = :active', { active: true })
    .stream()
  ).pipe(
    map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }))
  );
}
```

## 🔍 API Reference

### Enhanced Interfaces

```typescript
// Feature module options
interface GrpcFeatureOptions {
  controllers?: Type<any>[];                    // gRPC controllers
  services?: Type<any>[];                       // gRPC client services
  providers?: Provider[];                       // Additional providers
  imports?: Array<Type<any> | DynamicModule>;   // Module imports
  exports?: Array<Type<any> | string | symbol>; // Custom exports
}

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

### Module Methods

```typescript
// Static configuration
GrpcModule.forRoot(options: GrpcOptions)

// Async configuration
GrpcModule.forRootAsync(options: GrpcModuleAsyncOptions)

// Enhanced feature module
GrpcModule.forFeature(options: GrpcFeatureOptions)
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
git clone https://github.com/hmake98/nestjs-grpc.git
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