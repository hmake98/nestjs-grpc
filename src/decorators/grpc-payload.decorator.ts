import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator to extract the gRPC request payload from unary method calls.
 * Automatically extracts and provides type-safe access to the incoming request data.
 * Works seamlessly with TypeScript interfaces generated from proto definitions.
 *
 * @example
 * ```typescript
 * @GrpcController('UserService')
 * export class UserController {
 *   // Basic payload extraction
 *   @GrpcMethod('GetUser')
 *   async getUser(@GrpcPayload() payload: GetUserRequest): Promise<GetUserResponse> {
 *     const user = await this.userService.findById(payload.userId);
 *     return {
 *       user: {
 *         id: user.id,
 *         name: user.name,
 *         email: user.email
 *       }
 *     };
 *   }
 *
 *   // Payload with validation and transformation
 *   @GrpcMethod('CreateUser')
 *   async createUser(@GrpcPayload() payload: CreateUserRequest): Promise<CreateUserResponse> {
 *     // Payload automatically contains: { name, email, password }
 *     const validation = this.validateUserData(payload);
 *     if (!validation.isValid) {
 *       throw new GrpcException({
 *         code: GrpcErrorCode.INVALID_ARGUMENT,
 *         message: validation.errors.join(', ')
 *       });
 *     }
 *
 *     const newUser = await this.userService.create({
 *       name: payload.name,
 *       email: payload.email.toLowerCase(),
 *       passwordHash: await this.hashPassword(payload.password)
 *     });
 *
 *     return {
 *       user: { id: newUser.id, name: newUser.name, email: newUser.email },
 *       success: true
 *     };
 *   }
 *
 *   // Complex payload with nested objects
 *   @GrpcMethod('UpdateUserProfile')
 *   async updateProfile(@GrpcPayload() payload: UpdateUserProfileRequest): Promise<UpdateUserProfileResponse> {
 *     // Payload structure: { userId, profile: { name, bio, preferences: {...} } }
 *     const updatedUser = await this.userService.updateProfile(
 *       payload.userId,
 *       payload.profile
 *     );
 *
 *     return {
 *       success: true,
 *       user: this.transformUserToGrpcResponse(updatedUser)
 *     };
 *   }
 * }
 * ```
 */
export const GrpcPayload = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const rpc = ctx.switchToRpc();
    return rpc.getData();
});

/**
 * Parameter decorator to extract the gRPC streaming payload from streaming method calls.
 * Handles server streaming, client streaming, and bidirectional streaming scenarios.
 * Provides type-safe access to streaming request data with Observable support.
 *
 * @example
 * ```typescript
 * @GrpcController('DataService')
 * export class DataController {
 *   // Server streaming - single request, multiple responses
 *   @GrpcStream('GetDataStream')
 *   getDataStream(@GrpcStreamPayload() payload: DataStreamRequest): Observable<DataChunk> {
 *     return new Observable(observer => {
 *       const batchSize = payload.batchSize || 100;
 *       const startId = payload.startId || 0;
 *
 *       // Stream data in chunks
 *       this.dataService.getDataInBatches(startId, batchSize).forEach((batch, index) => {
 *         observer.next({
 *           chunkId: index,
 *           data: batch,
 *           hasMore: index < payload.expectedChunks - 1
 *         });
 *       });
 *
 *       observer.complete();
 *     });
 *   }
 *
 *   // Client streaming - multiple requests, single response
 *   @GrpcStream('UploadData')
 *   uploadData(@GrpcStreamPayload() payload: Observable<UploadChunk>): Observable<UploadResponse> {
 *     return payload.pipe(
 *       // Buffer chunks for processing
 *       bufferCount(10),
 *       // Process each buffer
 *       concatMap(chunks => {
 *         return this.dataService.processChunks(chunks);
 *       }),
 *       // Reduce to final result
 *       reduce((acc, result) => ({
 *         totalChunks: acc.totalChunks + result.processedChunks,
 *         totalSize: acc.totalSize + result.size,
 *         success: acc.success && result.success
 *       }), { totalChunks: 0, totalSize: 0, success: true }),
 *       // Return final upload response
 *       map(finalResult => ({
 *         uploadId: this.generateUploadId(),
 *         success: finalResult.success,
 *         totalChunks: finalResult.totalChunks,
 *         totalSize: finalResult.totalSize
 *       }))
 *     );
 *   }
 *
 *   // Bidirectional streaming - real-time data processing
 *   @GrpcStream('ProcessRealTimeData')
 *   processRealTimeData(@GrpcStreamPayload() payload: Observable<RealTimeDataRequest>): Observable<RealTimeDataResponse> {
 *     return payload.pipe(
 *       // Transform incoming data
 *       map(request => ({
 *         sessionId: request.sessionId,
 *         timestamp: request.timestamp,
 *         data: request.data
 *       })),
 *       // Process with real-time analytics
 *       switchMap(processedRequest => {
 *         return this.analyticsService.processRealTime(processedRequest);
 *       }),
 *       // Add response metadata
 *       map(result => ({
 *         processedAt: new Date().toISOString(),
 *         result: result.analysis,
 *         confidence: result.confidence,
 *         nextAction: result.recommendedAction
 *       })),
 *       // Handle errors gracefully
 *       catchError(error => {
 *         return of({
 *           processedAt: new Date().toISOString(),
 *           error: error.message,
 *           result: null,
 *           confidence: 0
 *         });
 *       })
 *     );
 *   }
 * }
 * ```
 */
export const GrpcStreamPayload = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const rpc = ctx.switchToRpc();
    return rpc.getData();
});
