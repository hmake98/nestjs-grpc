# nestjs-grpc AI Coding Instructions

## Project Overview

This is a production-ready NestJS package that provides type-safe gRPC
communication for microservices using a controller-based architecture. The
package wraps `@grpc/grpc-js` and provides NestJS-native decorators, DI support,
and both server (provider) and client (consumer) functionality.

## Architecture

### Dual-Mode Module System

The core `GrpcModule` operates in two distinct modes configured via static
factory methods:

1. **Provider Mode** (`forProvider`/`forProviderAsync`): Sets up a gRPC server
   that exposes RPC methods through decorated controllers
2. **Consumer Mode** (`forConsumer`/`forConsumerAsync`): Sets up gRPC clients to
   call external services

Both modes can coexist in the same application - a service can be both a
provider and consumer simultaneously.

### Core Service Architecture

- **GrpcProtoService**: Loads and parses `.proto` files using
  `@grpc/proto-loader` and `protobufjs`. Caches parsed definitions.
- **GrpcProviderService**: Manages the gRPC server lifecycle, routes incoming
  calls to controller methods. Discovers controllers via
  `GrpcControllerDiscoveryService`.
- **GrpcClientService**: Creates and pools gRPC client connections. Provides
  `call()` for unary requests and `serverStream()` for streaming. Implements
  automatic retry logic with exponential backoff.
- **GrpcRegistryService**: Manages controller registration, queues registrations
  until server is ready.
- **GrpcControllerDiscoveryService**: Uses NestJS `DiscoveryService` to find
  classes decorated with `@GrpcController` and register them.

### Metadata-Driven Design

Controllers and methods are discovered via TypeScript decorators that store
metadata using `reflect-metadata`:

- `@GrpcController(serviceName)`: Marks a class as a gRPC service handler.
  Stores metadata under `GRPC_CONTROLLER_METADATA`.
- `@GrpcMethod(methodName?)`: Marks a method as a unary RPC handler. Stores
  metadata under `GRPC_METHOD_METADATA`.
- `@GrpcStream(methodName?)`: Marks a method as a streaming RPC handler. Sets
  `streaming: true` in metadata.

The discovery service reads this metadata to map proto service definitions to
NestJS controller methods at runtime.

## Development Workflows

### Building and Testing

```bash
npm run build              # Clean, compile TypeScript, copy CLI binary
npm run test               # Jest with 99%+ coverage threshold, maxWorkers=1
npm run test:watch         # Watch mode for TDD
npm run lint               # ESLint with auto-fix
npm run format             # Prettier formatting
```

Tests run with `maxWorkers=1` to prevent port conflicts from parallel gRPC
servers. All tests use `jest.clearAllMocks()` and timer cleanup in
`test/setup.ts`.

### CLI Tool Development

The package includes a CLI tool at `bin/nestjs-grpc.js` (Node.js shebang script)
that wraps `src/cli/cli.ts` using Commander.js. After building, it's available
as `npx nestjs-grpc generate`.

The `generate` command uses `protobufjs` to parse `.proto` files and generates
TypeScript type definitions. It supports glob patterns, handles nested messages,
and generates optional class-based types with `--classes`.

### Publishing Workflow

```bash
npm run release:patch      # Bump patch version and publish
npm run release:minor      # Bump minor version and publish
npm run release:major      # Bump major version and publish
```

The `version` script automatically rebuilds docs and stages them for commit.

## Critical Patterns

### Controller Implementation Pattern

Controllers MUST match proto service definitions exactly:

```typescript
// Proto: service AuthService { rpc Login(LoginRequest) returns (LoginResponse); }

@GrpcController('AuthService')  // Service name from proto
export class AuthController {
  constructor(private authService: AuthService) {}  // DI works normally

  @GrpcMethod('Login')  // Method name from proto (can omit if handler name matches)
  async login(request: LoginRequest): Promise<LoginResponse> {
    // Return type must match proto response message
    return { token: '...', user: { ... } };
  }
}
```

Register controllers in the `controllers` array of the module that calls
`GrpcModule.forProvider()`.

### Streaming Methods

For server streaming, return an RxJS `Observable`:

```typescript
@GrpcStream('StreamUsers')
streamUsers(request: StreamUsersRequest): Observable<User> {
  return new Observable(observer => {
    // Emit multiple values
    users.forEach(user => observer.next(user));
    observer.complete();
  });
}
```

### Client Calls Pattern

Inject `GrpcClientService` and use typed generic calls:

```typescript
constructor(private grpcClient: GrpcClientService) {}

async callService() {
  const response = await this.grpcClient.call<Request, Response>(
    'AuthService',      // Service name from forConsumer config
    'ValidateToken',    // RPC method name
    { token: '...' }    // Request payload
  );
}
```

### Exception Handling

Use `GrpcException` with proper status codes:

```typescript
import { GrpcException } from 'nestjs-grpc';

// Static factory methods for common statuses
throw GrpcException.notFound('User not found');
throw GrpcException.unauthenticated('Invalid token');
throw GrpcException.invalidArgument('Missing required field');

// Custom status with details
throw new GrpcException({
    code: GrpcErrorCode.INTERNAL,
    message: 'Database connection failed',
    details: { retryable: true },
});
```

## Project-Specific Conventions

1. **Singleton Pattern**: Client instances are cached by connection key
   (service+URL hash). Cache TTL is 5 minutes with automatic cleanup.

2. **Logging**: All services use `GrpcLogger` wrapper with context. Enable via
   `logging: { enabled: true, level: 'debug', logPerformance: true }` in module
   config.

3. **Validation**: Options are validated in module static methods before module
   creation. Invalid configs throw immediately during app bootstrap.

4. **Type Safety**: Always use generated types from `npx nestjs-grpc generate`.
   The CLI matches the protobuf spec exactly.

5. **Test Isolation**: Tests mock `@grpc/grpc-js` server/client instances in
   `test/__mocks__/`. Never use real network calls in tests.

6. **File Naming**: Services follow `grpc-{name}.service.ts`, decorators follow
   `grpc-{name}.decorator.ts`. All exports flow through `src/index.ts`.

## Common Pitfalls

- **Controller not found**: Ensure the controller class is in the `controllers`
  array of the module with `forProvider()`, not just `providers`.
- **Method name mismatch**: Proto method names are case-sensitive. Use exact
  names from proto file.
- **Missing reflect-metadata**: Import `'reflect-metadata'` at app entry point
  before any NestJS imports.
- **Port conflicts in tests**: Use `maxWorkers=1` in Jest config and ensure
  proper server cleanup in `afterEach()`.
- **Stale client cache**: Clients are cached for 5 minutes. For testing,
  manually close clients or wait for TTL.

## Key Files

- `src/grpc.module.ts`: Core module with forProvider/forConsumer factory methods
- `src/services/grpc-provider.service.ts`: Server lifecycle and request routing
- `src/services/grpc-client.service.ts`: Client connection pooling and retry
  logic
- `src/decorators/`: Controller and method decorators with metadata definitions
- `src/constants.ts`: Metadata keys, error codes, and configuration defaults
- `test/setup.ts`: Global test configuration with timer cleanup
