# nestjs-grpc

A comprehensive NestJS package for building and consuming gRPC microservices with type safety and elegant integration.

## Table of Contents

1. [Installation](#installation)
2. [Module Configuration](#module-configuration)
3. [Service Implementation](#service-implementation)
4. [Client Usage](#client-usage)
5. [Error Handling](#error-handling)
6. [Type Generation](#type-generation)
7. [Streaming Support](#streaming-support)
8. [Advanced Features](#advanced-features)
9. [API Reference](#api-reference)

## Installation

```bash
npm install nestjs-grpc
```

For TypeScript development:

```bash
npm install nestjs-grpc @grpc/grpc-js @grpc/proto-loader --save
npm install @types/node --save-dev
```

## Module Configuration

### Basic Configuration

The simplest way to integrate gRPC into your NestJS application:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { join } from 'path';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    GrpcModule.forRoot({
      protoPath: join(__dirname, '../protos/user.proto'),
      package: 'user',
      url: 'localhost:50051'
    }),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class AppModule {}
```

### Async Configuration

For dynamic configuration, especially when using ConfigService:

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
        package: configService.get<string>('GRPC_PACKAGE', 'user'),
        url: configService.get<string>('GRPC_URL', 'localhost:50051'),
        secure: configService.get<boolean>('GRPC_SECURE', false),
      }),
    }),
  ],
})
export class AppModule {}
```

### Multiple Proto Files

You can load multiple proto files by providing a directory path:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { join } from 'path';

@Module({
  imports: [
    GrpcModule.forRoot({
      protoPath: join(__dirname, '../protos/'),  // Directory containing multiple proto files
      package: 'app',                           // Root package name
      url: 'localhost:50051',
    }),
  ],
})
export class AppModule {}
```

You can also use glob patterns:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';

@Module({
  imports: [
    GrpcModule.forRoot({
      protoPath: './protos/**/*.proto',  // Glob pattern to match multiple proto files
      package: 'app',
      url: 'localhost:50051',
    }),
  ],
})
export class AppModule {}
```

### Secure Communication (TLS)

For production environments, you'll want to enable TLS for secure communication:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { readFileSync } from 'fs';
import { join } from 'path';

@Module({
  imports: [
    GrpcModule.forRoot({
      protoPath: join(__dirname, '../protos/user.proto'),
      package: 'user',
      url: 'localhost:50051',
      secure: true,
      rootCerts: readFileSync(join(__dirname, '../certs/ca.crt')),
      privateKey: readFileSync(join(__dirname, '../certs/client.key')),
      certChain: readFileSync(join(__dirname, '../certs/client.crt')),
    }),
  ],
})
export class AppModule {}
```

### Advanced Configuration

Complete configuration with all available options:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GrpcModule } from 'nestjs-grpc';
import { readFileSync } from 'fs';
import { join } from 'path';

@Module({
  imports: [
    GrpcModule.forRoot({
      // Required options
      protoPath: join(__dirname, '../protos/user.proto'),
      package: 'user',

      // Server address (optional, defaults to localhost:50051)
      url: 'api.example.com:443',

      // TLS options
      secure: true,
      rootCerts: readFileSync(join(__dirname, '../certs/ca.crt')),
      privateKey: readFileSync(join(__dirname, '../certs/client.key')),
      certChain: readFileSync(join(__dirname, '../certs/client.crt')),

      // Performance tuning
      maxSendMessageSize: 10 * 1024 * 1024,    // 10MB
      maxReceiveMessageSize: 10 * 1024 * 1024, // 10MB

      // Proto loader options
      loaderOptions: {
        keepCase: true,                  // Keep field names as-is
        longs: String,                   // Map proto64 to strings
        enums: String,                   // Map enums to strings
        defaults: true,                  // Set default values
        oneofs: true,                    // Include oneofs
        arrays: true,                    // Use arrays for repeated fields
        objects: true,                   // Use objects for maps
        includeDirs: [                   // Include directories for imports
          join(__dirname, '../protos/common'),
        ],
      },
    }),
  ],
})
export class AppModule {}
```

## Service Implementation

### Basic Service Implementation

First, let's define a sample proto file:

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

Then implement the service in a controller:

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod } from 'nestjs-grpc';
import {
  User,
  GetUserRequest,
  CreateUserRequest,
  ListUsersRequest,
  ListUsersResponse
} from './generated/user';

@Controller()
@GrpcService('UserService')
export class UserController {
  private users: User[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  ];

  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest): Promise<User> {
    console.log(`GetUser called with ID: ${request.id}`);
    const user = this.users.find(u => u.id === request.id);

    if (!user) {
      throw new Error(`User with ID ${request.id} not found`);
    }

    return user;
  }

  @GrpcMethod('CreateUser')
  async createUser(request: CreateUserRequest): Promise<User> {
    const id = Math.floor(Math.random() * 1000).toString();
    const newUser = { id, name: request.name, email: request.email };

    this.users.push(newUser);
    console.log(`Created user: ${id}`);

    return newUser;
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

### Working with Metadata

gRPC metadata is similar to HTTP headers. Here's how to access and manipulate it:

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod, GrpcException } from 'nestjs-grpc';
import { Metadata } from '@grpc/grpc-js';

@Controller()
@GrpcService('UserService')
export class UserController {
  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest, metadata: Metadata): Promise<User> {
    // Access metadata values
    const token = metadata.get('authorization')[0];
    console.log(`Received token: ${token}`);

    // Validate token
    if (!token || !this.validateToken(token.toString())) {
      throw GrpcException.permissionDenied('Invalid or missing token');
    }

    // Process the request
    const user = this.users.find(u => u.id === request.id);
    if (!user) {
      throw GrpcException.notFound(`User with ID ${request.id} not found`);
    }

    return user;
  }

  private validateToken(token: string): boolean {
    // In a real app, implement proper token validation
    return token.startsWith('Bearer ');
  }
}
```

### Service with Different Method Types

gRPC supports four types of methods:

1. Unary (request-response)
2. Server streaming
3. Client streaming
4. Bidirectional streaming

Let's define a proto file with all types:

```protobuf
// chat.proto
syntax = "proto3";

package chat;

service ChatService {
  // Unary
  rpc SendMessage (Message) returns (MessageResponse) {}

  // Server streaming
  rpc SubscribeToMessages (SubscriptionRequest) returns (stream Message) {}

  // Client streaming
  rpc SendBulkMessages (stream Message) returns (BulkSendResponse) {}

  // Bidirectional streaming
  rpc Chat (stream Message) returns (stream Message) {}
}

message Message {
  string id = 1;
  string user_id = 2;
  string content = 3;
  int64 timestamp = 4;
}

message MessageResponse {
  string id = 1;
  bool delivered = 2;
}

message SubscriptionRequest {
  string room_id = 1;
}

message BulkSendResponse {
  int32 count = 1;
  bool success = 2;
}
```

Implementation:

```typescript
// chat.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod } from 'nestjs-grpc';
import { Observable, Subject, from } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  Message,
  MessageResponse,
  SubscriptionRequest,
  BulkSendResponse
} from './generated/chat';

@Controller()
@GrpcService('ChatService')
export class ChatController {
  private messageSubjects = new Map<string, Subject<Message>>();

  // Unary method
  @GrpcMethod('SendMessage')
  async sendMessage(message: Message): Promise<MessageResponse> {
    console.log(`Message received: ${message.content}`);

    // Broadcast to subscribers
    const roomId = message.room_id || 'default';
    const subject = this.getOrCreateSubject(roomId);
    subject.next(message);

    return {
      id: message.id,
      delivered: true,
    };
  }

  // Server streaming method
  @GrpcMethod({ methodName: 'SubscribeToMessages', streaming: true })
  subscribeToMessages(request: SubscriptionRequest): Observable<Message> {
    console.log(`New subscription to room: ${request.room_id}`);
    return this.getOrCreateSubject(request.room_id).asObservable();
  }

  // Client streaming method
  @GrpcMethod('SendBulkMessages')
  async sendBulkMessages(messages: Observable<Message>): Promise<BulkSendResponse> {
    let count = 0;

    return new Promise<BulkSendResponse>((resolve) => {
      messages.pipe(
        tap(message => {
          console.log(`Bulk message received: ${message.content}`);
          count++;

          // Broadcast to subscribers
          const roomId = message.room_id || 'default';
          const subject = this.getOrCreateSubject(roomId);
          subject.next(message);
        })
      ).subscribe({
        complete: () => {
          console.log(`Bulk send completed, total: ${count}`);
          resolve({ count, success: true });
        },
        error: (err) => {
          console.error('Error in bulk send:', err);
          resolve({ count, success: false });
        }
      });
    });
  }

  // Bidirectional streaming method
  @GrpcMethod({ methodName: 'Chat', streaming: true })
  chat(messages: Observable<Message>): Observable<Message> {
    // Echo service that adds a timestamp
    return messages.pipe(
      map(message => ({
        ...message,
        timestamp: Date.now(),
        content: `ECHO: ${message.content}`
      }))
    );
  }

  private getOrCreateSubject(roomId: string): Subject<Message> {
    if (!this.messageSubjects.has(roomId)) {
      this.messageSubjects.set(roomId, new Subject<Message>());
    }
    return this.messageSubjects.get(roomId);
  }
}
```

## Client Usage

### Basic Client Usage

Using the client to call gRPC services:

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';
import {
  UserServiceClient,
  User,
  GetUserRequest,
  CreateUserRequest,
  ListUsersRequest,
  ListUsersResponse
} from './generated/user';

@Injectable()
export class UserService implements OnModuleInit {
  private userClient: UserServiceClient;

  constructor(private readonly grpcClientService: GrpcClientService) {}

  onModuleInit() {
    // Initialize the client
    this.userClient = this.grpcClientService.create<UserServiceClient>('UserService');
  }

  async getUserById(id: string): Promise<User> {
    const request: GetUserRequest = { id };

    try {
      // Call the gRPC service (returns a Promise)
      return await this.userClient.getUser(request);
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

### Client with Custom Options

Configuring the client with custom options:

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class UserService implements OnModuleInit {
  private userClient: UserServiceClient;

  constructor(private readonly grpcClientService: GrpcClientService) {}

  onModuleInit() {
    // Create client with custom options
    this.userClient = this.grpcClientService.create<UserServiceClient>('UserService', {
      // Override URL (e.g., for different environments)
      url: 'user-service.example.com:443',

      // Set timeout
      timeout: 5000, // 5 seconds

      // Configure retries
      maxRetries: 3,
      retryDelay: 300, // 300ms between retries

      // Enable TLS for this specific client
      secure: true,
      rootCerts: readFileSync(join(__dirname, '../certs/ca.crt')),

      // Custom gRPC channel options
      channelOptions: {
        'grpc.keepalive_time_ms': 30000,
        'grpc.keepalive_timeout_ms': 10000,
        'grpc.max_concurrent_streams': 100,
      }
    });
  }
}
```

### Working with Metadata in Clients

Adding metadata to client requests:

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';
import { Metadata } from '@grpc/grpc-js';

@Injectable()
export class UserService implements OnModuleInit {
  private userClient: UserServiceClient;

  constructor(
    private readonly grpcClientService: GrpcClientService,
    private readonly authService: AuthService,
  ) {}

  onModuleInit() {
    this.userClient = this.grpcClientService.create<UserServiceClient>('UserService');
  }

  async getUserById(id: string): Promise<User> {
    // Create metadata
    const metadata = new Metadata();

    // Add auth token
    metadata.add('authorization', `Bearer ${this.authService.getToken()}`);

    // Add additional metadata
    metadata.add('client-version', '1.0.0');
    metadata.add('request-id', this.generateRequestId());

    // Binary metadata (must be a Buffer)
    metadata.add('binary-data', Buffer.from('some binary data'));

    // Send the request with metadata
    return this.userClient.getUser({ id }, metadata);
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
```

### Handling Streaming Responses

Working with server streaming methods:

```typescript
// chat.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';
import { Observable } from 'rxjs';
import { tap, map, filter } from 'rxjs/operators';
import { ChatServiceClient, Message, SubscriptionRequest } from './generated/chat';

@Injectable()
export class ChatService implements OnModuleInit {
  private chatClient: ChatServiceClient;

  constructor(private readonly grpcClientService: GrpcClientService) {}

  onModuleInit() {
    this.chatClient = this.grpcClientService.create<ChatServiceClient>('ChatService');
  }

  subscribeToRoom(roomId: string): Observable<Message> {
    const request: SubscriptionRequest = { room_id: roomId };

    // Server streaming returns an Observable
    return this.chatClient.subscribeToMessages(request).pipe(
      tap(message => console.log(`Message received: ${message.content}`)),
      filter(message => message.content !== ''), // Filter out empty messages
      map(message => ({
        ...message,
        content: message.content.toUpperCase(), // Transform the content
      }))
    );
  }

  // Example of using the streaming response
  startChatMonitoring(roomId: string): void {
    const subscription = this.subscribeToRoom(roomId).subscribe({
      next: (message) => {
        console.log(`[${new Date().toISOString()}] ${message.user_id}: ${message.content}`);
      },
      error: (err) => {
        console.error('Error in chat stream:', err);
        // Reconnect after error
        setTimeout(() => this.startChatMonitoring(roomId), 5000);
      },
      complete: () => {
        console.log('Chat stream completed');
      }
    });

    // Store subscription for cleanup
    this.activeSubscriptions.set(roomId, subscription);
  }

  stopChatMonitoring(roomId: string): void {
    const subscription = this.activeSubscriptions.get(roomId);
    if (subscription) {
      subscription.unsubscribe();
      this.activeSubscriptions.delete(roomId);
    }
  }
}
```

### Client Streaming Examples

Using client streaming to send multiple messages:

```typescript
// chat.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';
import { Observable, Subject } from 'rxjs';
import { ChatServiceClient, Message, BulkSendResponse } from './generated/chat';

@Injectable()
export class ChatService implements OnModuleInit {
  private chatClient: ChatServiceClient;

  constructor(private readonly grpcClientService: GrpcClientService) {}

  onModuleInit() {
    this.chatClient = this.grpcClientService.create<ChatServiceClient>('ChatService');
  }

  sendBulkMessages(messages: Message[]): Promise<BulkSendResponse> {
    // Create a subject that will emit messages
    const messageSubject = new Subject<Message>();

    // Start the client streaming request
    const response = this.chatClient.sendBulkMessages(messageSubject.asObservable());

    // Send messages one by one
    setTimeout(() => {
      messages.forEach(message => {
        console.log(`Sending message: ${message.content}`);
        messageSubject.next(message);
      });

      // Signal that we're done sending
      messageSubject.complete();
    }, 0);

    return response;
  }

  // Bidirectional streaming example
  chat(): { messageStream: Subject<Message>; responseStream: Observable<Message> } {
    // Subject for sending messages
    const messageSubject = new Subject<Message>();

    // Start the bidirectional stream
    const responseStream = this.chatClient.chat(messageSubject.asObservable());

    // Return both streams for the caller to use
    return {
      messageStream: messageSubject,
      responseStream
    };
  }

  // Usage example for bidirectional streaming
  startChatSession(): void {
    const { messageStream, responseStream } = this.chat();

    // Listen for responses
    responseStream.subscribe({
      next: (message) => {
        console.log(`Echo received: ${message.content}`);
      },
      error: (err) => {
        console.error('Chat error:', err);
      },
      complete: () => {
        console.log('Chat completed');
      }
    });

    // Send messages
    messageStream.next({
      id: '1',
      user_id: 'user1',
      content: 'Hello!',
      timestamp: Date.now()
    });

    // Send more messages later
    setTimeout(() => {
      messageStream.next({
        id: '2',
        user_id: 'user1',
        content: 'How are you?',
        timestamp: Date.now()
      });
    }, 1000);

    // End the chat after some time
    setTimeout(() => {
      messageStream.complete();
    }, 5000);
  }
}
```

## Error Handling

### Using GrpcException

The package provides a specialized `GrpcException` class for proper gRPC error handling:

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod, GrpcException, GrpcErrorCode } from 'nestjs-grpc';

@Controller()
@GrpcService('UserService')
export class UserController {
  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest): Promise<User> {
    // Basic error with code and message
    if (!request.id) {
      throw new GrpcException({
        code: GrpcErrorCode.INVALID_ARGUMENT,
        message: 'User ID is required',
      });
    }

    // Error with additional details
    if (request.id === 'invalid') {
      throw new GrpcException({
        code: GrpcErrorCode.INVALID_ARGUMENT,
        message: 'Invalid user ID format',
        details: {
          field: 'id',
          reason: 'format',
          expected: 'numeric ID',
          received: request.id
        }
      });
    }

    // Error with metadata
    if (request.id === 'unauthorized') {
      throw new GrpcException({
        code: GrpcErrorCode.PERMISSION_DENIED,
        message: 'User is not authorized to access this resource',
        metadata: {
          'error-type': 'authorization',
          'request-id': '12345',
          'retry-after': '60'
        }
      });
    }

    // Implementation...
  }
}
```

### Using Static Helper Methods

For common error types, you can use static helper methods:

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod, GrpcException } from 'nestjs-grpc';

@Controller()
@GrpcService('UserService')
export class UserController {
  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest): Promise<User> {
    // Simple error
    if (!request.id) {
      throw GrpcException.invalidArgument('User ID is required');
    }

    // With details
    if (request.id === 'invalid') {
      throw GrpcException.invalidArgument(
        'Invalid user ID format',
        { field: 'id', expected: 'numeric' }
      );
    }

    // With details and metadata
    if (request.id === 'expired') {
      throw GrpcException.permissionDenied(
        'User token has expired',
        { tokenExpiredAt: new Date().toISOString() },
        { 'retry-after': '3600', 'error-type': 'token-expired' }
      );
    }

    // Other common error types
    const user = this.getUserFromDb(request.id);

    if (!user) {
      throw GrpcException.notFound(`User with ID ${request.id} not found`);
    }

    if (this.isDeleted(user)) {
      throw GrpcException.notFound('User has been deleted');
    }

    if (this.isDuplicate(user)) {
      throw GrpcException.alreadyExists('User with this email already exists');
    }

    if (this.hasDbError()) {
      throw GrpcException.internal('Database connection error');
    }

    return user;
  }
}
```

### Handling Exceptions in Clients

Properly handling gRPC errors in client code:

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';
import { status } from '@grpc/grpc-js';

@Injectable()
export class UserService implements OnModuleInit {
  private userClient: UserServiceClient;

  constructor(private readonly grpcClientService: GrpcClientService) {}

  onModuleInit() {
    this.userClient = this.grpcClientService.create<UserServiceClient>('UserService');
  }

  async getUserById(id: string): Promise<User> {
    try {
      return await this.userClient.getUser({ id });
    } catch (error) {
      // Check error type and code
      if (error.code === status.NOT_FOUND) {
        console.log(`User ${id} not found`);
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (error.code === status.PERMISSION_DENIED) {
        console.log(`Permission denied for user ${id}`);
        throw new ForbiddenException('Not authorized to access this user');
      }

      if (error.code === status.INVALID_ARGUMENT) {
        console.log(`Invalid argument: ${error.message}`);
        throw new BadRequestException(error.message);
      }

      // Access metadata from error
      if (error.metadata) {
        const errorType = error.metadata.get('error-type');
        const retryAfter = error.metadata.get('retry-after');

        if (errorType && errorType[0] === 'rate-limited') {
          console.log(`Rate limited, retry after ${retryAfter[0]} seconds`);
        }
      }

      // Default error handling
      console.error('gRPC error:', error);
      throw new InternalServerErrorException('Error fetching user');
    }
  }
}
```

### Exception Filter

For advanced error handling, you can create a custom exception filter:

```typescript
// grpc-http.exception-filter.ts
import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { status } from '@grpc/grpc-js';
import { GrpcException } from 'nestjs-grpc';

@Catch(GrpcException)
export class GrpcToHttpExceptionFilter implements ExceptionFilter {
  catch(exception: GrpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Map gRPC status to HTTP status
    const httpStatus = this.mapGrpcToHttpStatus(exception.getCode());

    // Get error details
    const errorDetails = exception.getDetails() || {};

    // Get metadata
    const metadata = exception.getMetadata() || {};

    // Set response
    response.status(httpStatus).json({
      statusCode: httpStatus,
      message: exception.message,
      error: this.getErrorNameFromHttpStatus(httpStatus),
      details: errorDetails,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
      ...metadata,
    });
  }

  private mapGrpcToHttpStatus(grpcCode: number): number {
    switch (grpcCode) {
      case status.OK:
        return HttpStatus.OK;
      case status.CANCELLED:
        return HttpStatus.BAD_REQUEST;
      case status.UNKNOWN:
        return HttpStatus.INTERNAL_SERVER_ERROR;
      case status.INVALID_ARGUMENT:
        return HttpStatus.BAD_REQUEST;
      case status.DEADLINE_EXCEEDED:
        return HttpStatus.GATEWAY_TIMEOUT;
      case status.NOT_FOUND:
        return HttpStatus.NOT_FOUND;
      case status.ALREADY_EXISTS:
        return HttpStatus.CONFLICT;
      case status.PERMISSION_DENIED:
        return HttpStatus.FORBIDDEN;
      case status.UNAUTHENTICATED:
        return HttpStatus.UNAUTHORIZED;
      case status.RESOURCE_EXHAUSTED:
        return HttpStatus.TOO_MANY_REQUESTS;
      case status.FAILED_PRECONDITION:
        return HttpStatus.PRECONDITION_FAILED;
      case status.ABORTED:
        return HttpStatus.CONFLICT;
      case status.OUT_OF_RANGE:
        return HttpStatus.BAD_REQUEST;
      case status.UNIMPLEMENTED:
        return HttpStatus.NOT_IMPLEMENTED;
      case status.INTERNAL:
        return HttpStatus.INTERNAL_SERVER_ERROR;
      case status.UNAVAILABLE:
        return HttpStatus.SERVICE_UNAVAILABLE;
      case status.DATA_LOSS:
        return HttpStatus.INTERNAL_SERVER_ERROR;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  private getErrorNameFromHttpStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.PRECONDITION_FAILED:
        return 'Precondition Failed';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';
      case HttpStatus.NOT_IMPLEMENTED:
        return 'Not Implemented';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service Unavailable';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'Gateway Timeout';
      default:
        return 'Error';
    }
  }
}
```

Register the filter:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GrpcToHttpExceptionFilter } from './filters/grpc-http.exception-filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply filter globally
  app.useGlobalFilters(new GrpcToHttpExceptionFilter());

  await app.listen(3000);
}
bootstrap();
```

## Type Generation

### Basic CLI Usage

Generate TypeScript interfaces from proto files:

```bash
# Basic usage with one proto file
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated

# Process all proto files in a directory
npx nestjs-grpc generate --proto ./protos/ --output ./src/generated

# Use a glob pattern
npx nestjs-grpc generate --proto "./protos/**/*.proto" --output ./src/generated

# Recursive search in directories
npx nestjs-grpc generate --proto ./protos/ --recursive --output ./src/generated
```

### Generating Classes

Instead of interfaces, you can generate classes:

```bash
# Generate classes
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --classes
```

Generated output:

```typescript
// Generated class
export class User {
  id?: string;
  name?: string;
  email?: string;
}

// Instead of interface
export interface User {
  id?: string;
  name?: string;
  email?: string;
}
```

### Customizing Output

Various options for customizing generated types:

```bash
# Disable comments in generated files
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --no-comments

# Generate only types for a specific package
npx nestjs-grpc generate --proto ./protos/ --output ./src/generated --package-filter user

# Don't generate client interfaces
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --no-client-interfaces

# Verbose output
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --verbose

# Silent mode (minimal output)
npx nestjs-grpc generate --proto ./protos/user.proto --output ./src/generated --silent
```

### Sample Generated Output

Example of generated TypeScript definitions from a proto file:

```typescript
// Generated output for a proto file
import { Observable } from 'rxjs';

/**
 * Request message for getting a user by ID
 */
export interface GetUserRequest {
  id?: string;
}

/**
 * User creation request
 */
export interface CreateUserRequest {
  name?: string;
  email?: string;
}

/**
 * Pagination request for listing users
 */
export interface ListUsersRequest {
  page?: number;
  limit?: number;
}

/**
 * Response containing a list of users
 */
export interface ListUsersResponse {
  users?: User[];
  total?: number;
}

/**
 * User entity
 */
export interface User {
  id?: string;
  name?: string;
  email?: string;
}

/**
 * Client interface for UserService
 */
export interface UserServiceClient {
  getUser(request: GetUserRequest): Promise<User>;
  createUser(request: CreateUserRequest): Promise<User>;
  listUsers(request: ListUsersRequest): Promise<ListUsersResponse>;
}

/**
 * Controller interface for UserService
 */
export interface UserServiceController {
  getUser(request: GetUserRequest): Promise<User>;
  createUser(request: CreateUserRequest): Promise<User>;
  listUsers(request: ListUsersRequest): Promise<ListUsersResponse>;
}

/**
 * Status enum
 */
export enum UserStatus {
  ACTIVE = 0,
  INACTIVE = 1,
  SUSPENDED = 2,
}
```

## Streaming Support

### Server Streaming

Define streaming method in proto:

```protobuf
service UserService {
  // Server streaming
  rpc WatchUserUpdates (WatchUserRequest) returns (stream UserUpdate) {}
}

message WatchUserRequest {
  string user_id = 1;
}

message UserUpdate {
  string user_id = 1;
  string field = 2;
  string value = 3;
  int64 timestamp = 4;
}
```

Implement server streaming in controller:

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod } from 'nestjs-grpc';
import { Observable, interval } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { WatchUserRequest, UserUpdate } from './generated/user';

@Controller()
@GrpcService('UserService')
export class UserController {
  @GrpcMethod({ methodName: 'WatchUserUpdates', streaming: true })
  watchUserUpdates(request: WatchUserRequest): Observable<UserUpdate> {
    const userId = request.user_id;
    console.log(`Starting user update stream for user ${userId}`);

    // Simulate updates every second for 1 minute
    return interval(1000).pipe(
      take(60),
      map(i => {
        const updates = [
          { field: 'last_login', value: new Date().toISOString() },
          { field: 'status', value: 'online' },
          { field: 'activity', value: 'viewing dashboard' },
          { field: 'notifications', value: `${Math.floor(Math.random() * 10)}` }
        ];

        const update = updates[i % updates.length];

        return {
          user_id: userId,
          field: update.field,
          value: update.value,
          timestamp: Date.now()
        };
      })
    );
  }
}
```

Client consumption:

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { UserServiceClient, UserUpdate, WatchUserRequest } from './generated/user';

@Injectable()
export class UserService implements OnModuleInit {
  private userClient: UserServiceClient;

  constructor(private readonly grpcClientService: GrpcClientService) {}

  onModuleInit() {
    this.userClient = this.grpcClientService.create<UserServiceClient>('UserService');
  }

  watchUserUpdates(userId: string): Observable<UserUpdate> {
    const request: WatchUserRequest = { user_id: userId };

    return this.userClient.watchUserUpdates(request).pipe(
      tap(update => {
        console.log(`User ${userId} update: ${update.field} = ${update.value}`);
      }),
      // Transform or filter updates if needed
      map(update => ({
        ...update,
        timestamp_readable: new Date(Number(update.timestamp)).toISOString()
      }))
    );
  }
}
```

### Client Streaming

Define client streaming in proto:

```protobuf
service UserService {
  // Client streaming
  rpc BulkCreateUsers (stream CreateUserRequest) returns (BulkCreateResponse) {}
}

message BulkCreateResponse {
  int32 count = 1;
  bool success = 2;
  repeated string user_ids = 3;
}
```

Implement server-side handler:

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod } from 'nestjs-grpc';
import { Observable } from 'rxjs';
import { CreateUserRequest, BulkCreateResponse } from './generated/user';

@Controller()
@GrpcService('UserService')
export class UserController {
  @GrpcMethod('BulkCreateUsers')
  async bulkCreateUsers(requests: Observable<CreateUserRequest>): Promise<BulkCreateResponse> {
    const userIds: string[] = [];
    let count = 0;

    return new Promise<BulkCreateResponse>((resolve, reject) => {
      requests.subscribe({
        next: async (request) => {
          try {
            console.log(`Creating user: ${request.name}`);

            // Create user (in a real app, use your user service)
            const id = Math.floor(Math.random() * 10000).toString();
            userIds.push(id);
            count++;
          } catch (error) {
            console.error('Error creating user:', error);
          }
        },
        error: (err) => {
          console.error('Stream error:', err);
          reject(err);
        },
        complete: () => {
          console.log(`Bulk creation completed, created ${count} users`);
          resolve({
            count,
            success: true,
            user_ids: userIds
          });
        }
      });
    });
  }
}
```

Client implementation:

```typescript
// user.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';
import { Subject } from 'rxjs';
import { UserServiceClient, CreateUserRequest, BulkCreateResponse } from './generated/user';

@Injectable()
export class UserService implements OnModuleInit {
  private userClient: UserServiceClient;

  constructor(private readonly grpcClientService: GrpcClientService) {}

  onModuleInit() {
    this.userClient = this.grpcClientService.create<UserServiceClient>('UserService');
  }

  bulkCreateUsers(users: Array<{ name: string; email: string }>): Promise<BulkCreateResponse> {
    // Create subject for streaming requests
    const requestSubject = new Subject<CreateUserRequest>();

    // Start the client streaming request
    const response = this.userClient.bulkCreateUsers(requestSubject.asObservable());

    // Send each user creation request
    users.forEach(user => {
      requestSubject.next({
        name: user.name,
        email: user.email
      });
    });

    // Signal end of stream
    requestSubject.complete();

    return response;
  }
}
```

### Bidirectional Streaming

Define bidirectional streaming in proto:

```protobuf
service ChatService {
  // Bidirectional streaming
  rpc ChatSession (stream ChatMessage) returns (stream ChatMessage) {}
}

message ChatMessage {
  string user_id = 1;
  string room_id = 2;
  string content = 3;
  int64 timestamp = 4;
}
```

Implement bidirectional streaming handler:

```typescript
// chat.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcService, GrpcMethod } from 'nestjs-grpc';
import { Observable, Subject } from 'rxjs';
import { map, tap, mergeMap } from 'rxjs/operators';
import { ChatMessage } from './generated/chat';

@Controller()
@GrpcService('ChatService')
export class ChatController {
  // Store of message subjects by room
  private roomMessages = new Map<string, Subject<ChatMessage>>();

  @GrpcMethod({ methodName: 'ChatSession', streaming: true })
  chatSession(messages: Observable<ChatMessage>): Observable<ChatMessage> {
    // Create a subject for this user's messages
    const responseSubject = new Subject<ChatMessage>();
    let userRoom: string;
    let userId: string;

    // Process incoming messages
    messages.pipe(
      tap(message => {
        console.log(`Received message from ${message.user_id} in room ${message.room_id}: ${message.content}`);

        // Set user and room ID from first message
        if (!userRoom) {
          userRoom = message.room_id;
          userId = message.user_id;

          // Subscribe to room messages and forward to this user
          this.getRoomSubject(userRoom).subscribe(roomMessage => {
            // Don't echo the user's own messages back
            if (roomMessage.user_id !== userId) {
              responseSubject.next(roomMessage);
            }
          });
        }

        // Broadcast message to room
        this.broadcastToRoom(message);
      })
    ).subscribe({
      error: (err) => {
        console.error(`Error in chat session for user ${userId}:`, err);
        responseSubject.error(err);
      },
      complete: () => {
        console.log(`User ${userId} left chat room ${userRoom}`);

        // Notify others that user left
        if (userRoom) {
          this.broadcastToRoom({
            user_id: 'system',
            room_id: userRoom,
            content: `User ${userId} has left the chat`,
            timestamp: Date.now()
          });
        }

        // Don't complete the response stream - keeping it open for other users
      }
    });

    return responseSubject.asObservable();
  }

  private getRoomSubject(roomId: string): Subject<ChatMessage> {
    if (!this.roomMessages.has(roomId)) {
      this.roomMessages.set(roomId, new Subject<ChatMessage>());
    }
    return this.roomMessages.get(roomId);
  }

  private broadcastToRoom(message: ChatMessage): void {
    const roomSubject = this.getRoomSubject(message.room_id);
    roomSubject.next(message);
  }
}
```

Client implementation:

```typescript
// chat.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GrpcClientService } from 'nestjs-grpc';
import { Subject, Observable } from 'rxjs';
import { ChatServiceClient, ChatMessage } from './generated/chat';

@Injectable()
export class ChatService implements OnModuleInit {
  private chatClient: ChatServiceClient;

  constructor(private readonly grpcClientService: GrpcClientService) {}

  onModuleInit() {
    this.chatClient = this.grpcClientService.create<ChatServiceClient>('ChatService');
  }

  startChatSession(userId: string, roomId: string): {
    sendMessage: (content: string) => void;
    messages: Observable<ChatMessage>;
    endSession: () => void;
  } {
    // Create message subject for sending
    const messageSubject = new Subject<ChatMessage>();

    // Start bidirectional stream
    const responseStream = this.chatClient.chatSession(messageSubject.asObservable());

    // Function to send messages
    const sendMessage = (content: string) => {
      messageSubject.next({
        user_id: userId,
        room_id: roomId,
        content,
        timestamp: Date.now()
      });
    };

    // Function to end the session
    const endSession = () => {
      messageSubject.complete();
    };

    // Join the room
    sendMessage(`User ${userId} has joined the chat`);

    return {
      sendMessage,
      messages: responseStream,
      endSession
    };
  }

  // Example usage
  joinChatRoom(userId: string, roomId: string): void {
    const { sendMessage, messages, endSession } = this.startChatSession(userId, roomId);

    // Store session for future use
    this.activeSessions[userId] = { sendMessage, messages, endSession };

    // Subscribe to incoming messages
    messages.subscribe({
      next: (message) => {
        console.log(`[${new Date(Number(message.timestamp)).toLocaleTimeString()}] ${message.user_id}: ${message.content}`);
      },
      error: (err) => {
        console.error('Chat error:', err);
      },
      complete: () => {
        console.log('Chat session ended');
      }
    });
  }

  // Send a message to the room
  sendChatMessage(userId: string, content: string): void {
    const session = this.activeSessions[userId];
    if (session) {
      session.sendMessage(content);
    } else {
      console.error('No active session for user', userId);
    }
  }

  // Leave the room
  leaveChatRoom(userId: string): void {
    const session = this.activeSessions[userId];
    if (session) {
      session.endSession();
      delete this.activeSessions[userId];
    }
  }
}
```

## Advanced Features

### Using Interceptors with gRPC

Interceptors work with gRPC services just like with REST controllers:

```typescript
// logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const rpc = context.switchToRpc();
    const data = rpc.getData();
    const type = context.getType();

    console.log(`[${type}] Before... ${JSON.stringify(data)}`);
    const now = Date.now();

    return next.handle().pipe(
      tap(response => {
        const executionTime = Date.now() - now;
        console.log(`[${type}] After... ${executionTime}ms`);
        console.log(`Response: ${JSON.stringify(response)}`);
      }),
    );
  }
}
```

Register the interceptor:

```typescript
// user.controller.ts
import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcService, GrpcMethod } from 'nestjs-grpc';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

@Controller()
@GrpcService('UserService')
@UseInterceptors(LoggingInterceptor)  // Apply to all methods
export class UserController {
  @GrpcMethod('GetUser')
  @UseInterceptors(SomeOtherInterceptor)  // Apply to specific method
  async getUser(request: GetUserRequest): Promise<User> {
    // Implementation...
  }
}
```

### Using Guards with gRPC

gRPC-specific guards for authentication or authorization:

```typescript
// auth.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { GrpcException } from 'nestjs-grpc';

@Injectable()
export class GrpcAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Get the gRPC metadata
    const rpc = context.switchToRpc();
    const metadata = rpc.getContext() as Metadata;

    // Check for authentication token
    const token = metadata.get('authorization')[0];
    if (!token) {
      throw GrpcException.unauthenticated('Missing authentication token');
    }

    // Validate token
    try {
      const user = this.authService.validateToken(token.toString());

      // Add user to context
      metadata.set('user', JSON.stringify(user));

      return true;
    } catch (error) {
      throw GrpcException.unauthenticated('Invalid authentication token');
    }
  }
}
```

Using the guard:

```typescript
// user.controller.ts
import { Controller, UseGuards } from '@nestjs/common';
import { GrpcService, GrpcMethod } from 'nestjs-grpc';
import { GrpcAuthGuard } from './guards/auth.guard';

@Controller()
@GrpcService('UserService')
@UseGuards(GrpcAuthGuard)  // Apply to all methods
export class UserController {
  @GrpcMethod('GetUser')
  async getUser(request: GetUserRequest, metadata: Metadata): Promise<User> {
    // Get authenticated user from metadata
    const userJson = metadata.get('user')[0];
    const user = JSON.parse(userJson.toString());

    console.log(`Authenticated user: ${user.id} (${user.role})`);

    // Check permissions
    if (request.id !== user.id && user.role !== 'admin') {
      throw GrpcException.permissionDenied('Cannot access other user data');
    }

    // Implementation...
  }
}
```

### Testing gRPC Services

Testing gRPC controllers with NestJS testing utilities:

```typescript
// user.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { GrpcException } from 'nestjs-grpc';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      // You can provide mock providers here
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUser', () => {
    it('should return a user by id', async () => {
      const result = await controller.getUser({ id: '1' });

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
      expect(result.name).toBeDefined();
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      try {
        await controller.getUser({ id: 'nonexistent' });
        fail('should have thrown an exception');
      } catch (e) {
        expect(e).toBeInstanceOf(GrpcException);
        expect(e.getCode()).toBe(5); // NOT_FOUND code
      }
    });
  });
});
```

Testing gRPC clients by mocking the GrpcClientService:

```typescript
// user.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { GrpcClientService } from 'nestjs-grpc';
import { of, throwError } from 'rxjs';
import { status } from '@grpc/grpc-js';

describe('UserService', () => {
  let service: UserService;
  let grpcClientService: GrpcClientService;

  // Mock client
  const mockClient = {
    getUser: jest.fn(),
    createUser: jest.fn(),
    listUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: GrpcClientService,
          useValue: {
            create: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    grpcClientService = module.get<GrpcClientService>(GrpcClientService);

    // Initialize service to create client
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserById', () => {
    it('should return a user when successful', async () => {
      const mockUser = { id: '1', name: 'John Doe', email: 'john@example.com' };
      mockClient.getUser.mockResolvedValue(mockUser);

      const result = await service.getUserById('1');

      expect(mockClient.getUser).toHaveBeenCalledWith({ id: '1' }, undefined);
      expect(result).toEqual(mockUser);
    });

    it('should handle not found errors', async () => {
      // Create a gRPC error object
      const error = {
        code: status.NOT_FOUND,
        message: 'User not found',
        details: { requestedId: '999' },
      };

      mockClient.getUser.mockRejectedValue(error);

      await expect(service.getUserById('999')).rejects.toThrow(/not found/i);
    });
  });

  describe('listUsers', () => {
    it('should return an observable of users', (done) => {
      const mockResponse = {
        users: [
          { id: '1', name: 'John Doe', email: 'john@example.com' },
          { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
        ],
        total: 2,
      };

      mockClient.listUsers.mockResolvedValue(mockResponse);

      service.listUsers().subscribe({
        next: (result) => {
          expect(result).toEqual(mockResponse);
          expect(mockClient.listUsers).toHaveBeenCalledWith({ page: 1, limit: 10 });
          done();
        },
        error: done.fail,
      });
    });
  });
});
```

## API Reference

### GrpcModule

```typescript
// Static configuration
GrpcModule.forRoot(options: GrpcOptions): DynamicModule;

// Async configuration
GrpcModule.forRootAsync(options: GrpcModuleAsyncOptions): DynamicModule;
```

### GrpcOptions

```typescript
interface GrpcOptions {
  /**
   * Path to the proto file
   */
  protoPath: string;

  /**
   * Package name as defined in the proto file
   */
  package: string;

  /**
   * URL for the gRPC server (e.g., 'localhost:50051')
   */
  url?: string;

  /**
   * Whether to use secure connection (TLS)
   */
  secure?: boolean;

  /**
   * Root certificates for TLS (when secure is true)
   */
  rootCerts?: Buffer;

  /**
   * Private key for TLS (when secure is true)
   */
  privateKey?: Buffer;

  /**
   * Certificate chain for TLS (when secure is true)
   */
  certChain?: Buffer;

  /**
   * Maximum send message size in bytes
   */
  maxSendMessageSize?: number;

  /**
   * Maximum receive message size in bytes
   */
  maxReceiveMessageSize?: number;

  /**
   * Options for the proto loader
   */
  loaderOptions?: Options;
}
```

### GrpcClientOptions

```typescript
interface GrpcClientOptions {
  /**
   * Service name as defined in the proto file
   */
  service: string;

  /**
   * Package name as defined in the proto file
   */
  package?: string;

  /**
   * Proto file path (optional if global options are used)
   */
  protoPath?: string;

  /**
   * URL for the gRPC server (e.g., 'localhost:50051')
   */
  url?: string;

  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;

  /**
   * Whether to use secure connection (TLS)
   */
  secure?: boolean;

  /**
   * Root certificates for TLS (when secure is true)
   */
  rootCerts?: Buffer;

  /**
   * Private key for TLS (when secure is true)
   */
  privateKey?: Buffer;

  /**
   * Certificate chain for TLS (when secure is true)
   */
  certChain?: Buffer;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Custom gRPC channel options
   */
  channelOptions?: Record<string, any>;
}
```

### GrpcClientService

```typescript
class GrpcClientService implements OnModuleInit {
  /**
   * Creates a gRPC client for a service
   */
  create<T>(serviceName: string, options?: Partial<GrpcClientOptions>): T;
}
```

### Decorators

```typescript
/**
 * Marks a class as a gRPC service
 */
function GrpcService(serviceName: string): ClassDecorator;
function GrpcService(options: GrpcServiceOptions): ClassDecorator;

interface GrpcServiceOptions {
  /**
   * Service name as defined in the proto file
   */
  serviceName: string;

  /**
   * Package name as defined in the proto file
   */
  package?: string;
}

/**
 * Marks a method as a gRPC handler
 */
function GrpcMethod(methodName?: string): MethodDecorator;
function GrpcMethod(options: GrpcMethodOptions): MethodDecorator;

interface GrpcMethodOptions {
  /**
   * Method name as defined in the proto file
   */
  methodName?: string;

  /**
   * Whether the method is a streaming method
   */
  streaming?: boolean;
}
```

### GrpcException

```typescript
class GrpcException extends RpcException {
  /**
   * Creates a new GrpcException
   */
  constructor(options: GrpcExceptionOptions | string);

  /**
   * Gets the gRPC status code
   */
  getCode(): GrpcErrorCode;

  /**
   * Gets the error details
   */
  getDetails(): any;

  /**
   * Gets the error metadata
   */
  getMetadata(): Record<string, string | Buffer | string[] | Buffer[]>;

  /**
   * Converts the metadata to a gRPC Metadata object
   */
  toMetadata(): Metadata;

  /**
   * Creates a NOT_FOUND exception
   */
  static notFound(
    message: string,
    details?: any,
    metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
  ): GrpcException;

  /**
   * Creates an INVALID_ARGUMENT exception
   */
  static invalidArgument(
    message: string,
    details?: any,
    metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
  ): GrpcException;

  /**
   * Creates an ALREADY_EXISTS exception
   */
  static alreadyExists(
    message: string,
    details?: any,
    metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
  ): GrpcException;

  /**
   * Creates a PERMISSION_DENIED exception
   */
  static permissionDenied(
    message: string,
    details?: any,
    metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
  ): GrpcException;

  /**
   * Creates an INTERNAL exception
   */
  static internal(
    message: string,
    details?: any,
    metadata?: Record<string, string | Buffer | string[] | Buffer[]>,
  ): GrpcException;
}
```

### GrpcErrorCode

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

### CLI Options

```typescript
interface GenerateCommandOptions {
  /**
   * Path to proto file, directory, or glob pattern
   */
  proto: string;

  /**
   * Output directory for generated files
   */
  output: string;

  /**
   * Watch for changes
   */
  watch: boolean;

  /**
   * Recursively search directories
   */
  recursive?: boolean;

  /**
   * Generate classes instead of interfaces
   */
  classes?: boolean;

  /**
   * Include comments in generated files
   */
  comments?: boolean;

  /**
   * Filter by package name
   */
  packageFilter?: string;

  /**
   * Enable verbose logging
   */
  verbose?: boolean;

  /**
   * Disable all logging except errors
   */
  silent?: boolean;

  /**
   * Do not generate client interfaces
   */
  noClientInterfaces?: boolean;
}
```

## License

MIT