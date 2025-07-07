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
- 🧪 **Testing Friendly** - Easy mocking and testing utilities for gRPC services
- 🏗️ **Feature Modules** - Advanced `forFeature()` support with full dependency injection
- 🔌 **Complete DI Support** - Inject any NestJS service into gRPC controllers and clients
- 🗃️ **Database Integration** - Seamless integration with TypeORM, Prisma, and other ORMs
- ⚙️ **Configuration** - Built-in support for NestJS Config module and environment variables
- 🔍 **Error Handling** - Comprehensive gRPC exception handling with proper status codes

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

message LoginRequest {
  string email = 1;
  string password = 2;
}

message LoginResponse {
  string token = 1;
  User user = 2;
}

message ValidateTokenRequest {
  string token = 1;
}

message ValidateTokenResponse {
  bool valid = 1;
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

### 3. Set Up gRPC Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { AuthController } from './auth.controller';

@Module({
    imports: [
        GrpcModule.forRoot({
            protoPath: './protos/auth.proto',
            package: 'auth',
            url: 'localhost:50051',
            logging: {
                level: 'debug',
                logErrors: true,
                logPerformance: true,
            },
        }),
    ],
    controllers: [AuthController],
})
export class AppModule {}
```

### 4. Create gRPC Controller

```typescript
// auth.controller.ts
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { GrpcController, GrpcMethod, GrpcException, GrpcErrorCode } from 'nestjs-grpc';
import {
    LoginRequest,
    LoginResponse,
    ValidateTokenRequest,
    ValidateTokenResponse,
    StreamUsersRequest,
    User,
} from './generated/auth';

@GrpcController('AuthService')
export class AuthController {
    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
    ) {}

    @GrpcMethod('Login')
    async login(request: LoginRequest): Promise<LoginResponse> {
        try {
            const user = await this.userService.validateUser(request.email, request.password);

            if (!user) {
                throw GrpcException.unauthenticated('Invalid credentials');
            }

            const token = this.jwtService.sign({ userId: user.id });

            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                },
            };
        } catch (error) {
            if (error instanceof GrpcException) {
                throw error;
            }
            throw GrpcException.internal('Login failed', { error: error.message });
        }
    }

    @GrpcMethod('ValidateToken')
    async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
        try {
            const payload = this.jwtService.verify(request.token);
            const user = await this.userService.findById(payload.userId);

            return {
                valid: !!user,
                user: user
                    ? {
                          id: user.id,
                          email: user.email,
                          name: user.name,
                      }
                    : null,
            };
        } catch (error) {
            return { valid: false, user: null };
        }
    }

    @GrpcMethod('StreamUsers')
    streamUsers(request: StreamUsersRequest): Observable<User> {
        return new Observable(observer => {
            this.userService
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

### 5. Create gRPC Client

```typescript
// auth-client.service.ts
import { Injectable } from '@nestjs/common';
import { GrpcClientService, InjectGrpcClient } from 'nestjs-grpc';
import {
    LoginRequest,
    LoginResponse,
    ValidateTokenRequest,
    ValidateTokenResponse,
} from './generated/auth';

@Injectable()
export class AuthClientService {
    constructor(
        @InjectGrpcClient('AuthService')
        private readonly authClient: GrpcClientService,
    ) {}

    async login(email: string, password: string): Promise<LoginResponse> {
        return this.authClient.call<LoginRequest, LoginResponse>('AuthService', 'Login', {
            email,
            password,
        });
    }

    async validateToken(token: string): Promise<ValidateTokenResponse> {
        return this.authClient.call<ValidateTokenRequest, ValidateTokenResponse>(
            'AuthService',
            'ValidateToken',
            { token },
        );
    }
}
```

## 📖 Documentation

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

# Watch mode for development
npx nestjs-grpc generate --watch

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
| `-w, --watch`            | Watch mode for file changes                    | `false`                 |
| `-c, --classes`          | Generate classes instead of interfaces         | `false`                 |
| `--no-comments`          | Disable comments in generated files            | `false`                 |
| `--no-client-interfaces` | Do not generate client interfaces              | `false`                 |
| `-f, --package-filter`   | Filter by package name                         | -                       |
| `-r, --recursive`        | Recursively search directories                 | `true`                  |
| `-v, --verbose`          | Enable verbose logging                         | `false`                 |
| `-s, --silent`           | Disable all logging except errors              | `false`                 |

#### Generated Code Structure

```typescript
// Generated from auth.proto
export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user?: User;
}

export interface User {
    id: string;
    email: string;
    name: string;
}

// Service client interface (when --no-client-interfaces is not used)
export interface AuthServiceClient {
    login(request: LoginRequest): Promise<LoginResponse>;
    validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse>;
    streamUsers(request: StreamUsersRequest): Observable<User>;
}
```

### Module Configuration

#### Basic Configuration

```typescript
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';

@Module({
    imports: [
        GrpcModule.forRoot({
            protoPath: './protos/service.proto',
            package: 'service',
            url: 'localhost:50051',
        }),
    ],
})
export class AppModule {}
```

#### Async Configuration with ConfigService

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GrpcModule } from 'nestjs-grpc';

@Module({
    imports: [
        ConfigModule.forRoot(),
        GrpcModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                protoPath: configService.get('GRPC_PROTO_PATH', './protos/service.proto'),
                package: configService.get('GRPC_PACKAGE', 'service'),
                url: configService.get('GRPC_URL', 'localhost:50051'),
                secure: configService.get('GRPC_SECURE', false),
                maxSendMessageLength: configService.get('GRPC_MAX_SEND_SIZE', 4 * 1024 * 1024),
                maxReceiveMessageLength: configService.get(
                    'GRPC_MAX_RECEIVE_SIZE',
                    4 * 1024 * 1024,
                ),
                logging: {
                    level: configService.get('NODE_ENV') === 'development' ? 'debug' : 'log',
                    logErrors: true,
                    logPerformance: configService.get('GRPC_LOG_PERFORMANCE', false),
                },
            }),
        }),
    ],
})
export class AppModule {}
```

#### TLS/SSL Configuration

```typescript
import { readFileSync } from 'fs';

GrpcModule.forRoot({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'secure.example.com:443',
    secure: true,
    rootCerts: readFileSync('./certs/ca-cert.pem'),
    privateKey: readFileSync('./certs/client-key.pem'),
    certChain: readFileSync('./certs/client-cert.pem'),
});
```

### Feature Modules

Feature modules allow you to organize your gRPC services and provide better modularity.

#### Basic Feature Module

```typescript
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
    imports: [
        GrpcModule.forFeature({
            controllers: [UserController],
            providers: [UserService],
        }),
    ],
    exports: [UserService],
})
export class UserModule {}
```

#### Advanced Feature Module with Dependencies

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrpcModule } from 'nestjs-grpc';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderEntity } from './order.entity';
import { PaymentClientService } from './payment-client.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrderEntity]),
        GrpcModule.forFeature({
            controllers: [OrderController],
            providers: [OrderService],
            services: [PaymentClientService],
            imports: [TypeOrmModule.forFeature([OrderEntity])],
            exports: [OrderService],
        }),
    ],
})
export class OrderModule {}
```

## 🔄 Streaming Examples

### Server Streaming

```typescript
@GrpcController('DataService')
export class DataController {
    @GrpcMethod('StreamData')
    streamData(request: StreamDataRequest): Observable<DataChunk> {
        return new Observable(observer => {
            const chunks = this.generateDataChunks(request.size);

            let index = 0;
            const interval = setInterval(() => {
                if (index < chunks.length) {
                    observer.next(chunks[index]);
                    index++;
                } else {
                    observer.complete();
                    clearInterval(interval);
                }
            }, 100);

            // Cleanup on unsubscribe
            return () => clearInterval(interval);
        });
    }
}
```

### Client Streaming

```typescript
@Injectable()
export class UploadClientService {
    constructor(
        @InjectGrpcClient('UploadService')
        private readonly uploadClient: GrpcClientService,
    ) {}

    async uploadFile(filePath: string): Promise<UploadResponse> {
        const fileStream = createReadStream(filePath);
        const chunks: Observable<FileChunk> = new Observable(observer => {
            fileStream.on('data', (chunk: Buffer) => {
                observer.next({ data: chunk, filename: basename(filePath) });
            });

            fileStream.on('end', () => observer.complete());
            fileStream.on('error', error => observer.error(error));
        });

        return this.uploadClient.clientStream<FileChunk, UploadResponse>(
            'UploadService',
            'UploadFile',
            chunks,
        );
    }
}
```

### Bidirectional Streaming

```typescript
@GrpcController('ChatService')
export class ChatController {
    private readonly activeConnections = new Map<string, Observer<ChatMessage>>();

    @GrpcMethod('Chat')
    chat(request: Observable<ChatMessage>): Observable<ChatMessage> {
        return new Observable(observer => {
            const connectionId = this.generateConnectionId();
            this.activeConnections.set(connectionId, observer);

            request.subscribe({
                next: message => {
                    // Broadcast message to all connected clients
                    this.broadcastMessage(message, connectionId);
                },
                complete: () => {
                    this.activeConnections.delete(connectionId);
                },
                error: error => {
                    console.error('Chat error:', error);
                    this.activeConnections.delete(connectionId);
                },
            });

            return () => this.activeConnections.delete(connectionId);
        });
    }

    private broadcastMessage(message: ChatMessage, senderConnectionId: string) {
        this.activeConnections.forEach((observer, connectionId) => {
            if (connectionId !== senderConnectionId) {
                observer.next(message);
            }
        });
    }
}
```

## 🛡️ Error Handling

### Using GrpcException

```typescript
import { GrpcException, GrpcErrorCode } from 'nestjs-grpc';

@GrpcController('UserService')
export class UserController {
    @GrpcMethod('GetUser')
    async getUser(request: GetUserRequest): Promise<GetUserResponse> {
        const user = await this.userService.findById(request.id);

        if (!user) {
            // Standard gRPC exception with proper status code
            throw GrpcException.notFound(
                'User not found',
                { userId: request.id },
                { 'x-correlation-id': this.generateCorrelationId() },
            );
        }

        if (!this.hasPermission(request.requesterId, user.id)) {
            throw GrpcException.permissionDenied('Access denied to user resource');
        }

        return { user };
    }

    @GrpcMethod('CreateUser')
    async createUser(request: CreateUserRequest): Promise<CreateUserResponse> {
        try {
            if (!this.validateEmail(request.email)) {
                throw GrpcException.invalidArgument('Invalid email format', {
                    email: request.email,
                });
            }

            const existingUser = await this.userService.findByEmail(request.email);
            if (existingUser) {
                throw GrpcException.alreadyExists('User with this email already exists');
            }

            const user = await this.userService.create(request);
            return { user };
        } catch (error) {
            if (error instanceof GrpcException) {
                throw error;
            }

            // Convert unknown errors to internal gRPC errors
            throw GrpcException.internal('User creation failed', { error: error.message });
        }
    }
}
```

## 🧪 Testing

### Testing gRPC Controllers

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GrpcModule } from 'nestjs-grpc';
import { AuthController } from './auth.controller';
import { UserService } from './user.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthController', () => {
    let controller: AuthController;
    let userService: UserService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                GrpcModule.forRoot({
                    protoPath: './test/protos/auth.proto',
                    package: 'auth',
                    url: 'localhost:50051',
                }),
            ],
            controllers: [AuthController],
            providers: [
                {
                    provide: UserService,
                    useValue: {
                        validateUser: jest.fn(),
                        findById: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn(),
                        verify: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        userService = module.get<UserService>(UserService);
    });

    describe('login', () => {
        it('should return token and user on successful login', async () => {
            const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
            const mockToken = 'jwt-token';

            jest.spyOn(userService, 'validateUser').mockResolvedValue(mockUser);
            jest.spyOn(controller['jwtService'], 'sign').mockReturnValue(mockToken);

            const result = await controller.login({
                email: 'test@example.com',
                password: 'password',
            });

            expect(result).toEqual({
                token: mockToken,
                user: mockUser,
            });
        });

        it('should throw unauthenticated error for invalid credentials', async () => {
            jest.spyOn(userService, 'validateUser').mockResolvedValue(null);

            await expect(
                controller.login({
                    email: 'invalid@example.com',
                    password: 'wrong',
                }),
            ).rejects.toThrow('Invalid credentials');
        });
    });
});
```

### Testing gRPC Clients

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GrpcClientService } from 'nestjs-grpc';
import { AuthClientService } from './auth-client.service';

describe('AuthClientService', () => {
    let service: AuthClientService;
    let grpcClient: GrpcClientService;

    beforeEach(async () => {
        const mockGrpcClient = {
            call: jest.fn(),
            stream: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthClientService,
                {
                    provide: 'GRPC_CLIENT_AuthService',
                    useValue: mockGrpcClient,
                },
            ],
        }).compile();

        service = module.get<AuthClientService>(AuthClientService);
        grpcClient = module.get<GrpcClientService>('GRPC_CLIENT_AuthService');
    });

    it('should call login method with correct parameters', async () => {
        const mockResponse = {
            token: 'jwt-token',
            user: { id: '1', email: 'test@example.com', name: 'Test User' },
        };

        jest.spyOn(grpcClient, 'call').mockResolvedValue(mockResponse);

        const result = await service.login('test@example.com', 'password');

        expect(grpcClient.call).toHaveBeenCalledWith('AuthService', 'Login', {
            email: 'test@example.com',
            password: 'password',
        });
        expect(result).toEqual(mockResponse);
    });
});
```

## 🏗️ Microservices Architecture Examples

### API Gateway with gRPC Backends

```typescript
// api-gateway/src/app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';
import { AuthModule } from './auth/auth.module';

@Module({
    imports: [
        // Main gRPC module configuration
        GrpcModule.forRootAsync({
            useFactory: () => ({
                protoPath: ['./protos/user.proto', './protos/order.proto', './protos/auth.proto'],
                package: ['user', 'order', 'auth'],
                url: process.env.GRPC_URL || 'localhost:50051',
                logging: {
                    level: process.env.NODE_ENV === 'development' ? 'debug' : 'log',
                    logErrors: true,
                    logPerformance: true,
                },
            }),
        }),

        // Feature modules
        UserModule,
        OrderModule,
        AuthModule,
    ],
})
export class AppModule {}

// user/user.module.ts
@Module({
    imports: [
        GrpcModule.forFeature({
            services: [UserClientService, AuthClientService],
            providers: [UserService],
            controllers: [UserController],
        }),
    ],
    exports: [UserService],
})
export class UserModule {}

// user/user.controller.ts (HTTP REST API)
@Controller('users')
export class UserController {
    constructor(
        private readonly userClient: UserClientService,
        private readonly authClient: AuthClientService,
    ) {}

    @Get(':id')
    async getUser(@Param('id') id: string, @Headers('authorization') token: string) {
        // Validate token via gRPC
        const validation = await this.authClient.validateToken(token);
        if (!validation.valid) {
            throw new UnauthorizedException('Invalid token');
        }

        // Get user via gRPC
        return this.userClient.getUser({ id });
    }

    @Post()
    async createUser(@Body() createUserDto: CreateUserDto) {
        return this.userClient.createUser(createUserDto);
    }
}

// user/user-client.service.ts
@Injectable()
export class UserClientService {
    constructor(
        @InjectGrpcClient('UserService')
        private readonly userClient: GrpcClientService,
    ) {}

    async getUser(request: GetUserRequest): Promise<GetUserResponse> {
        return this.userClient.call<GetUserRequest, GetUserResponse>(
            'UserService',
            'GetUser',
            request,
            {
                timeout: 5000,
                retry: {
                    maxAttempts: 3,
                    delayMs: 1000,
                },
            },
        );
    }

    async createUser(request: CreateUserRequest): Promise<CreateUserResponse> {
        return this.userClient.call<CreateUserRequest, CreateUserResponse>(
            'UserService',
            'CreateUser',
            request,
        );
    }

    streamUsers(request: StreamUsersRequest): Observable<User> {
        return this.userClient.serverStream<StreamUsersRequest, User>(
            'UserService',
            'StreamUsers',
            request,
        );
    }
}
```

### Microservice Implementation

```typescript
// user-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { GrpcOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.createMicroservice<GrpcOptions>(AppModule, {
        transport: Transport.GRPC,
        options: {
            package: 'user',
            protoPath: './protos/user.proto',
            url: 'localhost:50051',
        },
    });

    await app.listen();
    console.log('User microservice is listening on localhost:50051');
}
bootstrap();

// user-service/src/app.module.ts
@Module({
    imports: [
        ConfigModule.forRoot(),
        TypeOrmModule.forRootAsync({
            useFactory: () => ({
                type: 'postgresql',
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT),
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                entities: [UserEntity],
                synchronize: process.env.NODE_ENV === 'development',
            }),
        }),
        GrpcModule.forRoot({
            protoPath: './protos/user.proto',
            package: 'user',
            url: 'localhost:50051',
        }),
    ],
    controllers: [UserController],
    providers: [UserService],
})
export class AppModule {}

// user-service/src/user.controller.ts
@GrpcController('UserService')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @GrpcMethod('GetUser')
    async getUser(request: GetUserRequest): Promise<GetUserResponse> {
        const user = await this.userService.findById(request.id);
        if (!user) {
            throw GrpcException.notFound('User not found');
        }
        return { user: this.toGrpcUser(user) };
    }

    @GrpcMethod('CreateUser')
    async createUser(request: CreateUserRequest): Promise<CreateUserResponse> {
        const user = await this.userService.create(request);
        return { user: this.toGrpcUser(user) };
    }

    @GrpcMethod('StreamUsers')
    streamUsers(request: StreamUsersRequest): Observable<User> {
        return new Observable(observer => {
            this.userService
                .findAllPaginated(request.limit, request.offset)
                .then(users => {
                    users.forEach(user => {
                        observer.next(this.toGrpcUser(user));
                    });
                    observer.complete();
                })
                .catch(error => {
                    observer.error(GrpcException.internal('Failed to stream users'));
                });
        });
    }

    private toGrpcUser(user: UserEntity): User {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
        };
    }
}
```

## 📊 Logging Configuration

### Basic Logging Setup

```typescript
GrpcModule.forRoot({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051',
    logging: {
        level: 'debug', // debug, verbose, log, warn, error
        logErrors: true, // Log all errors
        logPerformance: true, // Log performance metrics
        logDetails: true, // Log request/response details
        context: 'MyGrpcService', // Custom context for logs
    },
});
```

### Environment-Based Logging

```typescript
GrpcModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
        protoPath: config.get('GRPC_PROTO_PATH'),
        package: config.get('GRPC_PACKAGE'),
        url: config.get('GRPC_URL'),
        logging: {
            level: config.get('NODE_ENV') === 'development' ? 'debug' : 'log',
            logErrors: true,
            logPerformance: config.get('GRPC_LOG_PERFORMANCE', 'false') === 'true',
            logDetails: config.get('NODE_ENV') === 'development',
        },
    }),
});
```

### Sample Log Output

When debug logging is enabled, you'll see detailed information:

```
[Nest] 12345  - 01/01/2025, 10:00:00 AM     LOG [ProtoLoader] Loading proto files from: ./protos/auth.proto
[Nest] 12345  - 01/01/2025, 10:00:00 AM   DEBUG [ProtoLoader] Loaded services: AuthService
[Nest] 12345  - 01/01/2025, 10:00:00 AM     LOG [GrpcRegistry] Starting gRPC service discovery...
[Nest] 12345  - 01/01/2025, 10:00:00 AM     LOG [GrpcRegistry] Registered controller: AuthService
[Nest] 12345  - 01/01/2025, 10:00:00 AM   DEBUG [GrpcRegistry] Found gRPC method: AuthController.login
[Nest] 12345  - 01/01/2025, 10:00:01 AM     LOG [GrpcClient] Created gRPC client for service: AuthService
[Nest] 12345  - 01/01/2025, 10:00:01 AM   DEBUG [GrpcClient] Calling unary method: AuthService.login (took 45ms)
```

## 🔧 Configuration Options

### Complete Configuration Interface

```typescript
interface GrpcOptions {
    // Required
    protoPath: string; // Path to proto file(s)
    package: string; // Proto package name

    // Connection
    url?: string; // gRPC server URL (default: 'localhost:50051')
    secure?: boolean; // Use TLS (default: false)

    // TLS Configuration
    rootCerts?: Buffer; // Root certificates for TLS
    privateKey?: Buffer; // Private key for TLS
    certChain?: Buffer; // Certificate chain for TLS

    // Message Limits
    maxSendMessageLength?: number; // Max send message size (default: 4MB)
    maxReceiveMessageLength?: number; // Max receive message size (default: 4MB)

    // Timeouts
    keepaliveTimeMs?: number; // Keepalive time (default: 2 hours)
    keepaliveTimeoutMs?: number; // Keepalive timeout (default: 20 seconds)
    keepalivePermitWithoutCalls?: boolean; // Allow keepalive without calls

    // Retry Configuration
    maxRetryAttempts?: number; // Max retry attempts (default: 3)
    retryDelayMs?: number; // Delay between retries (default: 1000ms)

    // Proto Loader Options
    protoLoaderOptions?: {
        includeDirs?: string[]; // Include directories for proto files
        keepCase?: boolean; // Keep field name case (default: false)
        longs?: string | Function; // Long type conversion
        enums?: string; // Enum type conversion
        defaults?: boolean; // Include default values
        arrays?: boolean; // Use arrays for repeated fields
        objects?: boolean; // Use objects for map fields
        oneofs?: boolean; // Include oneof fields
    };

    // Logging
    logging?: {
        enabled?: boolean; // Enable/disable logging
        level?: LogLevel; // Log level
        context?: string; // Custom context
        logErrors?: boolean; // Log errors
        logPerformance?: boolean; // Log performance metrics
        logDetails?: boolean; // Log request/response details
    };
}
```

## 🎯 API Reference

### Core Classes and Decorators

#### Decorators

```typescript
// Controller decorator - marks a class as gRPC controller
@GrpcController(serviceName: string | GrpcControllerOptions)

// Method decorator - marks a method as gRPC handler
@GrpcMethod(methodName?: string | GrpcMethodOptions)

// Service decorator - marks a class as gRPC service client
@GrpcService(serviceName: string | GrpcServiceOptions)

// Injection decorator - injects gRPC client
@InjectGrpcClient(serviceName: string)
```

#### Modules

```typescript
// Root module configuration
GrpcModule.forRoot(options: GrpcOptions): DynamicModule
GrpcModule.forRootAsync(options: GrpcAsyncOptions): DynamicModule

// Feature module configuration
GrpcModule.forFeature(options: GrpcFeatureOptions): DynamicModule
```

#### Services

```typescript
// gRPC Client Service
class GrpcClientService {
    // Unary call
    call<TRequest, TResponse>(
        serviceName: string,
        methodName: string,
        request: TRequest,
        options?: GrpcClientOptions,
    ): Promise<TResponse>;

    // Server streaming
    serverStream<TRequest, TResponse>(
        serviceName: string,
        methodName: string,
        request: TRequest,
        options?: GrpcClientOptions,
    ): Observable<TResponse>;

    // Client streaming
    clientStream<TRequest, TResponse>(
        serviceName: string,
        methodName: string,
        request: Observable<TRequest>,
        options?: GrpcClientOptions,
    ): Promise<TResponse>;

    // Bidirectional streaming
    bidiStream<TRequest, TResponse>(
        serviceName: string,
        methodName: string,
        request: Observable<TRequest>,
        options?: GrpcClientOptions,
    ): Observable<TResponse>;
}
```

#### Exception Classes

```typescript
// Main exception class
class GrpcException extends RpcException {
    constructor(options: GrpcExceptionOptions | string);

    // Static factory methods for all gRPC status codes
    static ok(message?: string, details?: any, metadata?: any): GrpcException;
    static cancelled(message?: string, details?: any, metadata?: any): GrpcException;
    static unknown(message?: string, details?: any, metadata?: any): GrpcException;
    static invalidArgument(message?: string, details?: any, metadata?: any): GrpcException;
    static deadlineExceeded(message?: string, details?: any, metadata?: any): GrpcException;
    static notFound(message?: string, details?: any, metadata?: any): GrpcException;
    static alreadyExists(message?: string, details?: any, metadata?: any): GrpcException;
    static permissionDenied(message?: string, details?: any, metadata?: any): GrpcException;
    static resourceExhausted(message?: string, details?: any, metadata?: any): GrpcException;
    static failedPrecondition(message?: string, details?: any, metadata?: any): GrpcException;
    static aborted(message?: string, details?: any, metadata?: any): GrpcException;
    static outOfRange(message?: string, details?: any, metadata?: any): GrpcException;
    static unimplemented(message?: string, details?: any, metadata?: any): GrpcException;
    static internal(message?: string, details?: any, metadata?: any): GrpcException;
    static unavailable(message?: string, details?: any, metadata?: any): GrpcException;
    static dataLoss(message?: string, details?: any, metadata?: any): GrpcException;
    static unauthenticated(message?: string, details?: any, metadata?: any): GrpcException;
}
```

#### Error Codes

```typescript
enum GrpcErrorCode {
    OK = 0,
    CANCELLED = 1,
    UNKNOWN = 2,
    INVALID_ARGUMENT = 3,
    DEADLINE_EXCEEDED = 4,
    NOT_FOUND = 5,
    ALREADY_EXISTS = 6,
    PERMISSION_DENIED = 7,
    RESOURCE_EXHAUSTED = 8,
    FAILED_PRECONDITION = 9,
    ABORTED = 10,
    OUT_OF_RANGE = 11,
    UNIMPLEMENTED = 12,
    INTERNAL = 13,
    UNAVAILABLE = 14,
    DATA_LOSS = 15,
    UNAUTHENTICATED = 16,
}
```

## 🚀 Performance Tips

### Connection Pooling

```typescript
GrpcModule.forRoot({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051',
    // Enable connection pooling
    keepaliveTimeMs: 2 * 60 * 60 * 1000, // 2 hours
    keepaliveTimeoutMs: 20 * 1000, // 20 seconds
    keepalivePermitWithoutCalls: true,
    maxSendMessageLength: 16 * 1024 * 1024, // 16MB
    maxReceiveMessageLength: 16 * 1024 * 1024, // 16MB
});
```

### Client-Side Caching

```typescript
@Injectable()
export class CachedUserClientService {
    private cache = new Map<string, { data: any; expiry: number }>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(
        @InjectGrpcClient('UserService')
        private readonly userClient: GrpcClientService,
    ) {}

    async getUser(id: string): Promise<User> {
        const cached = this.cache.get(id);
        if (cached && cached.expiry > Date.now()) {
            return cached.data;
        }

        const user = await this.userClient.call<GetUserRequest, GetUserResponse>(
            'UserService',
            'GetUser',
            { id },
        );

        this.cache.set(id, {
            data: user,
            expiry: Date.now() + this.CACHE_TTL,
        });

        return user;
    }
}
```

## 🔧 Troubleshooting

### Common Issues

#### Proto File Loading Issues

```typescript
// Issue: Proto file not found
// Solution: Use absolute paths or proper relative paths
GrpcModule.forRoot({
    protoPath: path.join(__dirname, '../protos/service.proto'),
    package: 'service',
});

// Issue: Package not found
// Solution: Ensure package name matches proto file
// In service.proto: package com.example.service;
GrpcModule.forRoot({
    protoPath: './protos/service.proto',
    package: 'com.example.service', // Must match proto file
});
```

#### Connection Issues

```typescript
// Issue: Connection refused
// Solution: Check server URL and ensure server is running
GrpcModule.forRoot({
    protoPath: './protos/service.proto',
    package: 'service',
    url: 'localhost:50051', // Ensure server is running on this port
    logging: {
        level: 'debug', // Enable debug logging to see connection details
    },
});
```

#### Type Generation Issues

```bash
# Issue: Generated types are not up to date
# Solution: Regenerate types when proto files change
npx nestjs-grpc generate --proto "./protos/**/*.proto" --output "./src/generated"

# Issue: Import paths are incorrect
# Solution: Use absolute imports or configure path mapping in tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@generated/*": ["./src/generated/*"]
    }
  }
}
```

### Debug Mode

Enable comprehensive debugging:

```typescript
GrpcModule.forRoot({
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

# Run specific test file
npm test -- auth.controller.spec.ts
```

### Building Documentation

```bash
# Generate API documentation
npm run docs

# Serve documentation locally
npm run docs:serve
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/hmake98/nestjs-grpc)
- [npm Package](https://www.npmjs.com/package/nestjs-grpc)
- [API Documentation](https://hmake98.github.io/nestjs-grpc/)
- [gRPC Official Documentation](https://grpc.io/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Protocol Buffers Guide](https://developers.google.com/protocol-buffers)

## 🆘 Support

- [GitHub Issues](https://github.com/hmake98/nestjs-grpc/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/hmake98/nestjs-grpc/discussions) - Community support and questions
- [Stack Overflow](https://stackoverflow.com/questions/tagged/nestjs-grpc) - Technical questions

---

**Made with ❤️ for the NestJS community**

⭐ Star us on GitHub if this package helped you!
