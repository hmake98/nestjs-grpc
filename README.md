# nestjs-grpc

A NestJS package for type-safe gRPC communication between microservices.

## Features

- **Protocol Buffer Integration**: Seamless integration with `.proto` files
- **Type-Safe Communication**: Automatic TypeScript interface generation from proto definitions
- **NestJS Integration**: Custom decorators for gRPC controllers and methods
- **Client Factory**: Simple API for consuming gRPC services with Observable support
- **CLI Tool**: Generate TypeScript types from proto files with a single command
- **Exception Handling**: Proper error handling and status codes for gRPC

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

export interface User {
  id?: string;
  name?: string;
  email?: string;
}

export interface UserServiceClient {
  getUser(request: GetUserRequest): Observable<User>;
  createUser(request: CreateUserRequest): Observable<User>;
  listUsers(request: ListUsersRequest): Observable<ListUsersResponse>;
}

// etc...
```

### 3. Import GrpcModule in your app

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { join } from 'path';

@Module({
  imports: [
    GrpcModule.forRoot({
      protoPath: join(__dirname, '../protos/user.proto'),
      package: 'user',
      url: 'localhost:50051'
    }),
  ],
})
export class AppModule {}
```

### 4. Implement the gRPC service

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { GrpcService, GrpcMethod } from 'nestjs-grpc';
import { Observable, of } from 'rxjs';
import { 
  GetUserRequest, 
  User, 
  CreateUserRequest,
  ListUsersRequest,
  ListUsersResponse 
} from './generated/user';

@Injectable()
@GrpcService('UserService')
export class UserService {
  private users: User[] = [];

  @GrpcMethod('getUser')
  getUser(request: GetUserRequest): Observable<User> {
    const user = this.users.find(u => u.id === request.id);
    if (!user) {
      throw new Error('User not found');
    }
    return of(user);
  }

  @GrpcMethod('createUser')
  createUser(request: CreateUserRequest): Observable<User> {
    const user: User = {
      id: Date.now().toString(),
      name: request.name,
      email: request.email,
    };
    
    this.users.push(user);
    return of(user);
  }

  @GrpcMethod('listUsers')
  listUsers(request: ListUsersRequest): Observable<ListUsersResponse> {
    const { page = 1, limit = 10 } = request;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    
    return of({
      users: this.users.slice(startIdx, endIdx),
      total: this.users.length,
    });
  }
}
```

### 5. Consume the gRPC service from another service

```typescript
// client.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientFactory } from 'nestjs-grpc';
import { Observable } from 'rxjs';
import { UserServiceClient, User, GetUserRequest } from './generated/user';

@Injectable()
export class ClientService implements OnModuleInit {
  private userClient: UserServiceClient;

  constructor(private grpcClientFactory: GrpcClientFactory) {}

  onModuleInit() {
    this.userClient = this.grpcClientFactory.create<UserServiceClient>('UserService');
  }

  getUser(id: string): Observable<User> {
    return this.userClient.getUser({ id });
  }
}
```

## Client/Server Example

For a complete example of setting up both a gRPC server and client in a single project, see the [example directory](https://github.com/hmake98/nestjs-grpc-example).

## Advanced Configuration

### Async Configuration

You can use `forRootAsync` for dynamic module configuration:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    GrpcModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        protoPath: configService.get('GRPC_PROTO_PATH'),
        package: configService.get('GRPC_PACKAGE'),
        url: configService.get('GRPC_URL'),
      }),
    }),
  ],
})
export class AppModule {}
```

### Secure Communication (TLS)

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

### Error Handling

Use the built-in exception classes for proper gRPC error codes:

```typescript
import { GrpcException } from 'nestjs-grpc';
import { Observable, throwError } from 'rxjs';

@GrpcService('UserService')
export class UserService {
  @GrpcMethod('getUser')
  getUser(request: GetUserRequest): Observable<User> {
    const user = this.users.find(u => u.id === request.id);
    if (!user) {
      return throwError(() => 
        GrpcException.notFound(`User with ID ${request.id} not found`)
      );
    }
    return of(user);
  }
}
```

Apply the exception filter globally:

```typescript
import { NestFactory } from '@nestjs/core';
import { GrpcExceptionFilter } from 'nestjs-grpc';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GrpcExceptionFilter());
  await app.listen(3000);
}
bootstrap();
```

## CLI Tool Options

```
Usage: nestjs-grpc [options] [command]

Options:
  -V, --version         output the version number
  -h, --help            display help for command

Commands:
  generate [options]    Generate TypeScript definitions from protobuf files
  help [command]        display help for command

Generate options:
  -p, --proto <pattern>  Pattern to match proto files (default: "./protos/**/*.proto")
  -o, --output <dir>     Output directory for generated files (default: "./src/generated")
  -w, --watch            Watch mode for file changes
```

## API Reference

### GrpcModule

- `forRoot(options: GrpcOptions)`: Creates a module with static options
- `forRootAsync(options: GrpcModuleAsyncOptions)`: Creates a module with async options

### Decorators

- `@GrpcService(name: string | GrpcServiceOptions)`: Marks a class as a gRPC service
- `@GrpcMethod(name?: string | GrpcMethodOptions)`: Marks a method as a gRPC handler

### Services

- `GrpcClientFactory`: Factory service for creating gRPC clients
- `TypeGeneratorService`: Service for generating TypeScript interfaces
- `ProtoLoaderService`: Service for loading protobuf definitions

### Exceptions

- `GrpcException`: Base exception for gRPC errors
- `GrpcExceptionFilter`: Exception filter for handling gRPC errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT