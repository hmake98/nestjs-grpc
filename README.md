# nestjs-grpc

A NestJS package for type-safe gRPC communication between microservices.

## Features

- **Protocol Buffer Integration**: Seamless integration with `.proto` files
- **Type-Safe Communication**: Automatic TypeScript interface generation from proto definitions
- **NestJS Integration**: Custom decorators for gRPC controllers and methods
- **Client Factory**: Simple API for consuming gRPC services with Observable support
- **CLI Tool**: Generate TypeScript types from proto files with a single command
- **Exception Handling**: Proper error handling and status codes for gRPC
- **Metadata Handling**: Easy access to gRPC metadata with NestJS decorators
- **Authentication Support**: Simplified token extraction and validation

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
import { GrpcService, GrpcMethod, GrpcMetadata, GrpcAuthToken } from 'nestjs-grpc';
import { Observable, of } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
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
  getUser(
    request: GetUserRequest,
    @GrpcMetadata() metadata: Metadata
  ): Observable<User> {
    console.log('Client version:', metadata.get('client-version'));
    
    const user = this.users.find(u => u.id === request.id);
    if (!user) {
      throw new Error('User not found');
    }
    return of(user);
  }

  @GrpcMethod('createUser')
  createUser(
    request: CreateUserRequest,
    @GrpcAuthToken() token: string
  ): Observable<User> {
    // Use the extracted auth token
    console.log('Auth token:', token);
    
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
import { GrpcClientFactory, MetadataUtils } from 'nestjs-grpc';
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
    // Create metadata with client version
    const metadata = MetadataUtils.fromObject({
      'client-version': '1.0.0'
    });
    
    return this.userClient.getUser({ id }, metadata);
  }
  
  getUserWithAuth(id: string, token: string): Observable<User> {
    // Create metadata with authentication token
    const metadata = MetadataUtils.withAuthToken(token);
    
    return this.userClient.getUser({ id }, metadata);
  }
}
```

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
      throw GrpcException.notFound(`User with ID ${request.id} not found`);
    }
    return of(user);
  }
}
```

The exception filter is automatically registered when importing the GrpcModule.

### Type Generation Options

Generate TypeScript interfaces with additional options:

```bash
# Generate classes instead of interfaces
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --classes

# Disable comments in generated files
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --no-comments

# Filter types by package name
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --package-filter user

# Watch mode for regenerating on changes
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --watch
```

### Working with Metadata

#### Server-side Metadata Handling

Extract metadata in service methods:

```typescript
@GrpcService('UserService')
export class UserService {
  @GrpcMethod('getUser')
  getUser(
    request: GetUserRequest,
    @GrpcMetadata() metadata: Metadata  // Get full metadata object
  ): Observable<User> {
    // Access all metadata
    console.log('Client version:', metadata.get('client-version'));
    // ...
  }
  
  @GrpcMethod('updateUser')
  updateUser(
    request: UpdateUserRequest,
    @GrpcMetadata('client-version') version: string  // Get specific metadata value
  ): Observable<User> {
    // Access specific metadata value directly
    console.log('Client version:', version);
    // ...
  }
  
  @GrpcMethod('deleteUser')
  deleteUser(
    request: DeleteUserRequest,
    @GrpcAuthToken() token: string  // Extract auth token
  ): Observable<Empty> {
    // Validate token
    console.log('Auth token:', token);
    // ...
  }
}
```

#### Client-side Metadata Handling

```typescript
import { MetadataUtils } from 'nestjs-grpc';
import { Metadata } from '@grpc/grpc-js';

// Create metadata from object
const metadata = MetadataUtils.fromObject({
  'client-version': '1.0.0',
  'user-agent': 'nestjs-client'
});

// Create metadata with auth token
const authMetadata = MetadataUtils.withAuthToken('my-jwt-token');

// Merge metadata objects
const mergedMetadata = MetadataUtils.merge(metadata, authMetadata);

// Send request with metadata
userClient.getUser({ id: '123' }, metadata);
```

## CLI Tool Options

```
Usage: nestjs-grpc [options] [command]

Options:
  -V, --version                output the version number
  -h, --help                   display help for command

Commands:
  generate [options]           Generate TypeScript definitions from protobuf files
  help [command]               display help for command

Generate options:
  -p, --proto <pattern>        Pattern to match proto files (default: "./protos/**/*.proto")
  -o, --output <dir>           Output directory for generated files (default: "./src/generated")
  -w, --watch                  Watch mode for file changes
  -c, --classes                Generate classes instead of interfaces
  --no-comments                Disable comments in generated files
  -f, --package-filter <name>  Filter by package name
  -r, --recursive              Recursively search directories for .proto files (default: true)
```

## API Reference

### GrpcModule

- `forRoot(options: GrpcOptions)`: Creates a module with static options
- `forRootAsync(options: GrpcModuleAsyncOptions)`: Creates a module with async options

### Decorators

- `@GrpcService(name: string | GrpcServiceOptions)`: Marks a class as a gRPC service
- `@GrpcMethod(name?: string | GrpcMethodOptions)`: Marks a method as a gRPC handler
- `@GrpcMetadata(key?: string)`: Extracts metadata or a specific metadata value from a request
- `@GrpcAuthToken()`: Extracts the authorization token from request metadata

### Services

- `GrpcClientFactory`: Factory service for creating gRPC clients
- `TypeGeneratorService`: Service for generating TypeScript interfaces
- `ProtoLoaderService`: Service for loading protobuf definitions
- `GrpcMetadataExplorer`: Service for exploring metadata usage in controllers

### Exceptions

- `GrpcException`: Base exception for gRPC errors with metadata support
  - Static methods:
    - `notFound(message, details?, metadata?)`
    - `invalidArgument(message, details?, metadata?)`
    - `permissionDenied(message, details?, metadata?)`
    - `unauthenticated(message, details?, metadata?)`
    - `alreadyExists(message, details?, metadata?)`
    - `internal(message, details?, metadata?)`
    - `deadlineExceeded(message, details?, metadata?)`
    - `failedPrecondition(message, details?, metadata?)`
    - `resourceExhausted(message, details?, metadata?)`
    - `cancelled(message, details?, metadata?)`
- `GrpcExceptionFilter`: Exception filter for handling gRPC errors

### Utilities

- `MetadataUtils`: Helper methods for working with gRPC metadata
  - `fromObject(obj)`: Creates a Metadata object from a plain object
  - `toObject(metadata)`: Converts Metadata to a plain object
  - `merge(...metadataObjects)`: Merges multiple Metadata objects
  - `get(metadata, key, defaultValue?)`: Gets a value from metadata
  - `getAll(metadata, key)`: Gets all values for a key
  - `has(metadata, key)`: Checks if metadata has a key
  - `getAuthToken(metadata)`: Extracts auth token from metadata
  - `setAuthToken(metadata, token, scheme?)`: Sets auth token in metadata
  - `withAuthToken(token, scheme?)`: Creates metadata with auth token

## Error Codes

The package maps HTTP status codes to gRPC error codes automatically:

| HTTP Status | gRPC Status Code |
|-------------|------------------|
| 400 | INVALID_ARGUMENT |
| 401 | UNAUTHENTICATED |
| 403 | PERMISSION_DENIED |
| 404 | NOT_FOUND |
| 409 | ALREADY_EXISTS |
| 429 | RESOURCE_EXHAUSTED |
| 500 | INTERNAL |
| 501 | UNIMPLEMENTED |
| 503 | UNAVAILABLE |
| 504 | UNAVAILABLE |
| 408 | DEADLINE_EXCEEDED |
| 412 | FAILED_PRECONDITION |
| 413 | RESOURCE_EXHAUSTED |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT