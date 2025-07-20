import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator to extract the gRPC request payload from unary method calls.
 * This decorator automatically extracts the request data from the gRPC call context.
 *
 * @example
 * ```typescript
 * @GrpcController('UserService')
 * export class UserController {
 *   @GrpcMethod('GetUser')
 *   async getUser(@GrpcPayload() payload: GetUserRequest): Promise<GetUserResponse> {
 *     const user = await this.userService.findById(payload.userId);
 *     return { user };
 *   }
 *
 *   @GrpcMethod('CreateUser')
 *   async createUser(@GrpcPayload() payload: CreateUserRequest): Promise<CreateUserResponse> {
 *     const user = await this.userService.create(payload);
 *     return { user };
 *   }
 * }
 * ```
 */
export const GrpcPayload = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const rpcContext = ctx.switchToRpc();
    return rpcContext.getData();
});

/**
 * Parameter decorator to extract the gRPC stream payload from streaming method calls.
 * This decorator automatically extracts the request data from the gRPC stream context.
 *
 * @example
 * ```typescript
 * @GrpcController('ChatService')
 * export class ChatController {
 *   @GrpcStream('Chat')
 *   async chat(@GrpcStreamPayload() payload: ChatMessage): Promise<ChatResponse> {
 *     // Handle streaming chat messages
 *     return { message: `Echo: ${payload.message}` };
 *   }
 * }
 * ```
 */
export const GrpcStreamPayload = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const rpcContext = ctx.switchToRpc();
    return rpcContext.getData();
});
