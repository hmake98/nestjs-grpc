# nestjs-grpc

A NestJS package for type-safe gRPC communication between microservices with monitoring dashboard.

## Features

- **Protocol Buffer Integration**: Seamless integration with `.proto` files
- **Type-Safe Communication**: Automatic TypeScript interface generation from proto definitions
- **NestJS Integration**: Custom decorators for gRPC controllers and methods
- **Client Factory**: Simple API for consuming gRPC services with Observable support
- **CLI Tool**: Generate TypeScript types from proto files with a single command
- **Exception Handling**: Proper error handling and status codes for gRPC
- **Metadata Handling**: Easy access to gRPC metadata with NestJS decorators
- **Authentication Support**: Simplified token extraction and validation
- **Configurable Logging**: Flexible logging system with customizable log levels and outputs
- **Monitoring Dashboard**: Real-time monitoring of gRPC services, connections, and requests

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
import { LogLevel } from 'nestjs-grpc';

@Module({
  imports: [
    GrpcModule.forRoot({
      protoPath: join(__dirname, '../protos/user.proto'),
      package: 'user',
      url: 'localhost:50051',
      logger: {
        level: LogLevel.INFO,  // Configure log level
        prettyPrint: true,     // Enable pretty printing (colored output)
      },
      // Enable the monitoring dashboard (optional)
      dashboard: {
        enable: true,
        apiPrefix: 'grpc-dashboard/api', // API endpoint for dashboard
        maxLogs: 1000,                  // Maximum number of logs to keep
        cors: { origin: '*' }           // CORS settings for WebSocket
      }
    }),
  ],
})
export class AppModule {}
```

### 4. Implement the gRPC service

```typescript
// user.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { GrpcService, GrpcMethod, GrpcMetadata, GrpcAuthToken, GrpcLogger, GRPC_LOGGER } from 'nestjs-grpc';
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

  constructor(@Inject(GRPC_LOGGER) private readonly logger: GrpcLogger) {}

  @GrpcMethod('getUser')
  getUser(
    request: GetUserRequest,
    @GrpcMetadata() metadata: Metadata
  ): Observable<User> {
    this.logger.debug(`GetUser request for ID: ${request.id}`, 'UserService');
    this.logger.verbose(`Client version: ${metadata.get('client-version')}`, 'UserService');
    
    const user = this.users.find(u => u.id === request.id);
    if (!user) {
      this.logger.warn(`User not found: ${request.id}`, 'UserService');
      throw new Error('User not found');
    }
    
    this.logger.info(`User retrieved: ${user.id}`, 'UserService');
    return of(user);
  }

  @GrpcMethod('createUser')
  createUser(
    request: CreateUserRequest,
    @GrpcAuthToken() token: string
  ): Observable<User> {
    // Use the extracted auth token
    this.logger.debug(`Auth token: ${token}`, 'UserService');
    
    const user: User = {
      id: Date.now().toString(),
      name: request.name,
      email: request.email,
    };
    
    this.users.push(user);
    this.logger.info(`User created: ${user.id}`, 'UserService');
    return of(user);
  }

  @GrpcMethod('listUsers')
  listUsers(request: ListUsersRequest): Observable<ListUsersResponse> {
    const { page = 1, limit = 10 } = request;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    
    this.logger.debug(`ListUsers request: page=${page}, limit=${limit}`, 'UserService');
    
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
import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { GrpcClientFactory, MetadataUtils, GRPC_LOGGER, GrpcLogger } from 'nestjs-grpc';
import { Observable } from 'rxjs';
import { UserServiceClient, User, GetUserRequest } from './generated/user';

@Injectable()
export class ClientService implements OnModuleInit {
  private userClient: UserServiceClient;

  constructor(
    private grpcClientFactory: GrpcClientFactory,
    @Inject(GRPC_LOGGER) private readonly logger: GrpcLogger
  ) {}

  onModuleInit() {
    this.userClient = this.grpcClientFactory.create<UserServiceClient>('UserService');
    this.logger.info('gRPC client initialized', 'ClientService');
  }

  getUser(id: string): Observable<User> {
    this.logger.debug(`Fetching user with ID: ${id}`, 'ClientService');
    
    // Create metadata with client version
    const metadata = MetadataUtils.fromObject({
      'client-version': '1.0.0'
    });
    
    return this.userClient.getUser({ id }, metadata);
  }
  
  getUserWithAuth(id: string, token: string): Observable<User> {
    this.logger.debug(`Fetching user with ID: ${id} (authenticated)`, 'ClientService');
    
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
import { GrpcModule, LogLevel } from 'nestjs-grpc';
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
        logger: {
          level: configService.get('LOG_LEVEL') === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
          prettyPrint: configService.get('LOG_PRETTY_PRINT') === 'true',
        },
        // Configure dashboard asynchronously
        dashboard: {
          enable: configService.get('DASHBOARD_ENABLED') === 'true',
          apiPrefix: configService.get('DASHBOARD_PREFIX') || 'grpc-dashboard/api',
          maxLogs: parseInt(configService.get('DASHBOARD_MAX_LOGS') || '1000'),
        }
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
  logger: {
    level: LogLevel.INFO,
  }
})
```

### Error Handling

Use the built-in exception classes for proper gRPC error codes:

```typescript
import { GrpcException } from 'nestjs-grpc';
import { Observable, throwError } from 'rxjs';

@GrpcService('UserService')
export class UserService {
  constructor(@Inject(GRPC_LOGGER) private readonly logger: GrpcLogger) {}

  @GrpcMethod('getUser')
  getUser(request: GetUserRequest): Observable<User> {
    const user = this.users.find(u => u.id === request.id);
    if (!user) {
      this.logger.warn(`User not found: ${request.id}`, 'UserService');
      throw GrpcException.notFound(`User with ID ${request.id} not found`);
    }
    return of(user);
  }
}
```

The exception filter is automatically registered when importing the GrpcModule.

## Monitoring Dashboard

The package includes a built-in monitoring dashboard for gRPC services that provides:

- Service discovery and listing
- Request and response monitoring
- Connection tracking
- Detailed logs with filtering
- Real-time statistics

### Dashboard Configuration

```typescript
import { GrpcModule } from 'nestjs-grpc';

@Module({
  imports: [
    GrpcModule.forRoot({
      // ... other options
      dashboard: {
        enable: true,                   // Enable the dashboard (default: true)
        apiPrefix: 'grpc-dashboard/api', // API endpoint for dashboard (default: 'grpc-dashboard/api')
        maxLogs: 1000,                   // Maximum number of logs to keep (default: 1000)
        cors: { origin: '*' }            // CORS settings for WebSocket (default: { origin: '*' })
      }
    }),
  ],
})
export class AppModule {}
```

### Dashboard API Endpoints

After configuring the dashboard, you can access the following REST API endpoints:

- `GET /{apiPrefix}/services` - List all discovered gRPC services
- `GET /{apiPrefix}/services/:id` - Get details for a specific service
- `GET /{apiPrefix}/connections` - List all active connections
- `GET /{apiPrefix}/logs` - Get logs with optional filtering
- `GET /{apiPrefix}/stats` - Get request statistics
- `GET /{apiPrefix}/info` - Get basic system information

### WebSocket Events

The dashboard also provides real-time updates via WebSocket with the following events:

- `log` - Emitted when a new log entry is added
- `connection` - Emitted when a connection is established or updated
- `stats` - Emitted when statistics are updated

### Using the Dashboard as a Standalone Module

You can also use the dashboard module independently:

```typescript
import { Module } from '@nestjs/common';
import { GrpcDashboardModule } from 'nestjs-grpc/dashboard';

@Module({
  imports: [
    GrpcDashboardModule.forRoot({
      enable: true,
      apiPrefix: 'monitoring/grpc',
      maxLogs: 2000,
      cors: { origin: 'http://localhost:3000' }
    }),
  ],
})
export class MonitoringModule {}
```

## Logging Configuration

### Configure Log Levels

```typescript
import { GrpcModule, LogLevel } from 'nestjs-grpc';

@Module({
  imports: [
    GrpcModule.forRoot({
      // ... other options
      logger: {
        level: LogLevel.DEBUG,  // Set log level: ERROR, WARN, INFO, DEBUG, VERBOSE
        prettyPrint: true,      // Enable colored output
        disable: false,         // Completely disable logging
      }
    }),
  ],
})
export class AppModule {}
```

### Using a Custom Logger

You can implement your own logger by implementing the `GrpcLogger` interface:

```typescript
import { GrpcLogger, LogLevel } from 'nestjs-grpc';

export class CustomLogger implements GrpcLogger {
  private level: LogLevel = LogLevel.INFO;
  
  constructor(private context: string = 'App') {}
  
  error(message: string, context?: string, trace?: string): void {
    if (this.level < LogLevel.ERROR) return;
    console.error(`[ERROR] [${context || this.context}] ${message}`);
    if (trace) console.error(trace);
  }
  
  warn(message: string, context?: string): void {
    if (this.level < LogLevel.WARN) return;
    console.warn(`[WARN] [${context || this.context}] ${message}`);
  }
  
  info(message: string, context?: string): void {
    if (this.level < LogLevel.INFO) return;
    console.info(`[INFO] [${context || this.context}] ${message}`);
  }
  
  debug(message: string, context?: string): void {
    if (this.level < LogLevel.DEBUG) return;
    console.debug(`[DEBUG] [${context || this.context}] ${message}`);
  }
  
  verbose(message: string, context?: string): void {
    if (this.level < LogLevel.VERBOSE) return;
    console.log(`[VERBOSE] [${context || this.context}] ${message}`);
  }
  
  setLogLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Use the custom logger
@Module({
  imports: [
    GrpcModule.forRoot({
      // ... other options
      logger: {
        customLogger: new CustomLogger('GrpcApp'),
        level: LogLevel.DEBUG,
      }
    }),
  ],
})
export class AppModule {}
```

### Accessing the Logger in Your Services

The logger can be injected into any service using the `GRPC_LOGGER` token:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { GRPC_LOGGER, GrpcLogger } from 'nestjs-grpc';

@Injectable()
export class AppService {
  constructor(@Inject(GRPC_LOGGER) private readonly logger: GrpcLogger) {
    // Use logger in your service
    this.logger.info('AppService initialized');
  }
  
  doSomething(): void {
    this.logger.debug('Doing something...', 'AppService');
    // ... implementation
    this.logger.info('Operation completed successfully', 'AppService');
  }
}
```

## CLI Tool Options

### Code Generation

Generate TypeScript interfaces from proto files:

```bash
# Basic usage
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated

# Generate classes instead of interfaces
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --classes

# Disable comments in generated files
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --no-comments

# Filter types by package name
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --package-filter user

# Watch mode for regenerating on changes
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --watch

# Enable verbose logging
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --verbose

# Disable all logging except errors
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --silent

# Generate without client interfaces
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --no-client-interfaces
```

### CLI Help

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
  --no-client-interfaces       Do not generate client interfaces
  -f, --package-filter <name>  Filter by package name
  -r, --recursive              Recursively search directories for .proto files (default: true)
  -v, --verbose                Enable verbose logging
  -s, --silent                 Disable all logging except errors
```

## API Reference

### GrpcModule

- `forRoot(options: GrpcOptions)`: Creates a module with static options
- `forRootAsync(options: GrpcModuleAsyncOptions)`: Creates a module with async options

### GrpcDashboardModule

- `forRoot(options?: GrpcDashboardOptions)`: Creates a dashboard module with static options
- `forRootAsync(options: GrpcDashboardAsyncOptions)`: Creates a dashboard module with async options

### Decorators

- `@GrpcService(name: string | GrpcServiceOptions)`: Marks a class as a gRPC service
- `@GrpcMethod(name?: string | GrpcMethodOptions)`: Marks a method as a gRPC handler
- `@GrpcMetadata(key?: string)`: Extracts metadata or a specific metadata value from a request
- `@GrpcAuthToken()`: Extracts the authorization token from request metadata

### Services

- `GrpcClientFactory`: Factory service for creating gRPC clients
- `TypeGeneratorService`: Service for generating TypeScript interfaces
- `ProtoLoaderService`: Service for loading protobuf definitions
- `GrpcLoggerService`: Service for logging with configurable log levels
- `GrpcDashboardService`: Service for monitoring gRPC services

### Logging

- `LogLevel`: Enum for log levels (ERROR, WARN, INFO, DEBUG, VERBOSE)
- `GrpcLogger`: Interface for implementing custom loggers
- `GRPC_LOGGER`: Injection token for the logger
- `GrpcLoggerOptions`: Configuration options for the logger

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
| 413         | RESOURCE_EXHAUSTED  |

## Module Support

The package fully supports both CommonJS and ES Modules:

```javascript
// CommonJS
const { GrpcModule } = require('nestjs-grpc');

// ES Modules
import { GrpcModule } from 'nestjs-grpc';
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT