# nestjs-grpc

A lightweight NestJS package for type-safe gRPC communication between microservices.

## Features

- **Protocol Buffer Integration**: Seamless integration with `.proto` files
- **Type-Safe Communication**: Automatic TypeScript interface generation from proto definitions
- **NestJS Integration**: Custom decorators for gRPC controllers and methods
- **Client Factory**: Simple API for consuming gRPC services with Promise and Observable support
- **CLI Tool**: Generate TypeScript types from proto files with a single command
- **Exception Handling**: Proper error handling and status codes for gRPC
- **Metadata Support**: Easy access to gRPC metadata

## Installation

```bash
npm install nestjs-grpc
```

## Quick Start

### 1. Define your proto file

```protobuf
// user.proto
syntax = "proto3";

package user;

service UserService {
  rpc GetUser (GetUserRequest) returns (User) {}
  rpc CreateUser (CreateUserRequest) returns (User) {}
  rpc ListUsers (ListUsersRequest) returns (ListUsersResponse) {}
}

message GetUserRequest {
  string id = 1;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message ListUsersRequest {
  int32 page = 1;
  int32 limit = 2;
}

message ListUsersResponse {
  repeated User users = 1;
  int32 total = 2;
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
}
```

### 2. Generate TypeScript interfaces

```bash
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated
```

This will generate TypeScript interfaces in `./src/generated/user.ts`:

```typescript
// Generated interfaces
export interface GetUserRequest {
  id?: string;
}

export interface CreateUserRequest {
  name?: string;
  email?: string;
}

export interface ListUsersRequest {
  page?: number;
  limit?: number;
}

export interface ListUsersResponse {
  users?: User[];
  total?: number;
}

export interface User {
  id?: string;
  name?: string;
  email?: string;
}

export interface UserServiceClient {
  getUser(request: GetUserRequest): Promise<User>;
  createUser(request: CreateUserRequest): Promise<User>;
  listUsers(request: ListUsersRequest): Promise<ListUsersResponse>;
}

export interface UserServiceController {
  getUser(request: GetUserRequest): Promise<User>;
  createUser(request: CreateUserRequest): Promise<User>;
  listUsers(request: ListUsersRequest): Promise<ListUsersResponse>;
}
```

### 3. Set up your NestJS application

#### 3.1 Root module configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { join } from 'path';
import { UserController } from './user.controller';
import { UserClientService } from './user-client.service';

@Module({
  imports: [
    GrpcModule.forRoot({
      protoPath: join(__dirname, '../protos/user.proto'),
      package: 'user',
      url: 'localhost:50051'
    }),
  ],
  controllers: [UserController],
  providers: [UserClientService],
})
export class AppModule {}
```

#### 3.2 gRPC service implementation

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod, GrpcException } from 'nestjs-grpc';
import { Metadata } from '@grpc/grpc-js';
import { 
  GetUserRequest, 
  User, 
  CreateUserRequest,
  ListUsersRequest,
  ListUsersResponse 
} from './generated/user';

@Controller()
@GrpcService('UserService')
export class UserController {
  // In-memory users store for demonstration
  private users: User[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  ];

  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest, metadata: Metadata): Promise<User> {
    console.log(`GetUser request for ID: ${request.id}`);
    console.log(`Request metadata:`, metadata);
    
    const user = this.users.find(u => u.id === request.id);
    if (!user) {
      throw GrpcException.notFound(`User with ID ${request.id} not found`);
    }
    
    return user;
  }

  @GrpcMethod('CreateUser')
  async createUser(request: CreateUserRequest): Promise<User> {
    const user: User = {
      id: Math.floor(Math.random() * 10000).toString(),
      name: request.name,
      email: request.email,
    };
    
    this.users.push(user);
    console.log(`User created: ${user.id}`);
    return user;
  }

  @GrpcMethod('ListUsers')
  async listUsers(request: ListUsersRequest): Promise<ListUsersResponse> {
    const { page = 1, limit = 10 } = request;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    
    return {
      users: this.users.slice(startIdx, endIdx),
      total: this.users.length,
    };
  }
}
```

#### 3.3 Consuming gRPC services

```typescript
// user-client.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientFactory } from 'nestjs-grpc';
import { Metadata } from '@grpc/grpc-js';
import { 
  UserServiceClient, 
  User, 
  GetUserRequest,
  CreateUserRequest,
  ListUsersRequest,
  ListUsersResponse 
} from './generated/user';

@Injectable()
export class UserClientService implements OnModuleInit {
  private userClient: UserServiceClient;

  constructor(private readonly grpcClientFactory: GrpcClientFactory) {}

  onModuleInit() {
    // Create the gRPC client
    this.userClient = this.grpcClientFactory.create<UserServiceClient>('UserService');
  }

  async getUser(id: string): Promise<User> {
    const request: GetUserRequest = { id };
    
    // Create metadata (optional)
    const metadata = new Metadata();
    metadata.add('client-version', '1.0.0');
    
    try {
      // Call the gRPC service
      return await this.userClient.getUser(request, metadata);
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }

  async createUser(name: string, email: string): Promise<User> {
    const request: CreateUserRequest = { name, email };
    return this.userClient.createUser(request);
  }

  async listUsers(page: number = 1, limit: number = 10): Promise<ListUsersResponse> {
    const request: ListUsersRequest = { page, limit };
    return this.userClient.listUsers(request);
  }
}
```

#### 3.4 Using the client service in a REST controller

```typescript
// rest.controller.ts
import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { UserClientService } from './user-client.service';

@Controller('users')
export class RestController {
  constructor(private readonly userClientService: UserClientService) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.userClientService.getUser(id);
  }

  @Post()
  async createUser(@Body() data: { name: string; email: string }) {
    return this.userClientService.createUser(data.name, data.email);
  }

  @Get()
  async listUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.userClientService.listUsers(page, limit);
  }
}
```

### 4. Error Handling

The package includes built-in error handling with proper gRPC status codes:

```typescript
import { GrpcException } from 'nestjs-grpc';

@GrpcService('UserService')
export class UserController {
  // ...

  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest): Promise<User> {
    const user = this.users.find(u => u.id === request.id);
    
    // Different error types with appropriate gRPC status codes
    if (!user) {
      throw GrpcException.notFound(`User with ID ${request.id} not found`);
    }
    
    if (!request.id) {
      throw GrpcException.invalidArgument('User ID is required');
    }
    
    if (!this.hasPermission()) {
      throw GrpcException.permissionDenied('Not authorized to view this user');
    }
    
    if (this.isSystemError()) {
      throw GrpcException.internal('Internal system error');
    }
    
    return user;
  }
}
```

### 5. Advanced Configuration

#### 5.1 Async Configuration

Use `forRootAsync` for dynamic module configuration:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot(),
    GrpcModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        protoPath: join(__dirname, '../protos/user.proto'),
        package: 'user',
        url: configService.get<string>('GRPC_URL'),
        secure: configService.get<boolean>('GRPC_SECURE') || false,
      }),
    }),
  ],
})
export class AppModule {}
```

#### 5.2 Secure Communication (TLS)

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

GrpcModule.forRoot({
  protoPath: join(__dirname, '../protos/user.proto'),
  package: 'user',
  url: 'localhost:50051',
  secure: true,
  rootCerts: readFileSync(join(__dirname, '../certs/ca.pem')),
  privateKey: readFileSync(join(__dirname, '../certs/server-key.pem')),
  certChain: readFileSync(join(__dirname, '../certs/server-cert.pem')),
})
```

#### 5.3 Multiple Proto Files

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { join } from 'path';

@Module({
  imports: [
    GrpcModule.forRoot({
      protoPath: join(__dirname, '../protos/'),  // Directory with multiple proto files
      package: 'app',                            // Root package name
      url: 'localhost:50051',
    }),
  ],
})
export class AppModule {}
```

Then generate types for all proto files:

```bash
npx nestjs-grpc generate --proto ./protos/ --output ./src/generated
```

### 6. CLI Tool Options

```bash
# Basic usage
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated

# Generate classes instead of interfaces
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --classes

# Disable comments in generated files
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --no-comments

# Filter types by package name
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --package-filter user

# Generate without client interfaces
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --no-client-interfaces

# Process multiple files using a glob pattern
npx nestjs-grpc generate --proto "./protos/**/*.proto" --output ./src/generated

# Verbose output
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --verbose
```

### 7. Streaming Methods

For streaming methods in your proto file:

```protobuf
service UserService {
  // Server streaming
  rpc WatchUsers (WatchUsersRequest) returns (stream User) {}
  
  // Client streaming
  rpc CreateUsers (stream CreateUserRequest) returns (CreateUsersResponse) {}
  
  // Bidirectional streaming
  rpc Chat (stream ChatMessage) returns (stream ChatMessage) {}
}
```

Implementation in the controller:

```typescript
@GrpcService('UserService')
export class UserController {
  @GrpcMethod('WatchUsers')
  watchUsers(request: WatchUsersRequest): Observable<User> {
    // Return an Observable for server streaming
    return interval(1000).pipe(
      take(5),
      map(index => ({
        id: (index + 1).toString(),
        name: `User ${index + 1}`,
        email: `user${index + 1}@example.com`,
      }))
    );
  }
  
  // Other streaming methods...
}
```

Client usage:

```typescript
// For streaming responses
const userStream = this.userClient.watchUsers(request);
userStream.subscribe({
  next: (user) => console.log('Received user:', user),
  error: (err) => console.error('Error:', err),
  complete: () => console.log('Stream completed'),
});
```

## API Reference

### Decorators

- `@GrpcService(name: string | { serviceName: string, package?: string })`: 
  Marks a class as a gRPC service
  
- `@GrpcMethod(name?: string | { methodName?: string, streaming?: boolean })`: 
  Marks a method as a gRPC handler

### Services

- `GrpcClientFactory`: Factory service for creating gRPC clients

### Exceptions

- `GrpcException`: Base exception for gRPC errors with metadata support
  - Static methods:
    - `notFound(message, details?, metadata?)`
    - `invalidArgument(message, details?, metadata?)`
    - `permissionDenied(message, details?, metadata?)`
    - `unauthenticated(message, details?, metadata?)`
    - `alreadyExists(message, details?, metadata?)`
    - `internal(message, details?, metadata?)`
    - and more...

## Error Codes Mapping

The package maps HTTP status codes to gRPC error codes automatically:

| HTTP Status | gRPC Status Code    |
| ----------- | ------------------- |
| 400         | INVALID_ARGUMENT    |
| 401         | UNAUTHENTICATED     |
| 403         | PERMISSION_DENIED   |
| 404         | NOT_FOUND           |
| 409         | ALREADY_EXISTS      |
| 429         | RESOURCE_EXHAUSTED  |
| 500         | INTERNAL            |
| 501         | UNIMPLEMENTED       |
| 503         | UNAVAILABLE         |
| 504         | UNAVAILABLE         |
| 408         | DEADLINE_EXCEEDED   |
| 412         | FAILED_PRECONDITION |

## License

MIT