import { GRPC_METHOD_METADATA } from '../constants';

import type { GrpcMethodOptions } from '../interfaces';

/**
 * Decorator that marks a method as a gRPC streaming method handler.
 * Supports server streaming, client streaming, and bidirectional streaming patterns.
 * Always sets the streaming flag to true automatically.
 *
 * @param methodNameOrOptions - The method name as defined in the proto file or options object
 *
 * @example
 * ```typescript
 * @GrpcController('DataService')
 * export class DataController {
 *   // Server streaming - send multiple responses for one request
 *   @GrpcStream('GetDataStream')
 *   getDataStream(request: DataRequest): Observable<DataChunk> {
 *     return new Observable(observer => {
 *       const data = this.dataService.getLargeDataset(request.id);
 *
 *       // Send data in chunks
 *       data.forEach((chunk, index) => {
 *         observer.next({ chunk, index, total: data.length });
 *       });
 *
 *       observer.complete();
 *     });
 *   }
 *
 *   // Client streaming - receive multiple requests, send one response
 *   @GrpcStream('UploadData')
 *   uploadData(request: Observable<UploadChunk>): Observable<UploadResponse> {
 *     return request.pipe(
 *       // Collect all chunks
 *       toArray(),
 *       // Process the complete upload
 *       switchMap(chunks => {
 *         return this.dataService.processUpload(chunks);
 *       }),
 *       // Return final response
 *       map(result => ({ success: true, uploadId: result.id }))
 *     );
 *   }
 *
 *   // Bidirectional streaming - real-time chat example
 *   @GrpcStream({ methodName: 'Chat', timeout: 0 }) // No timeout for chat
 *   chat(request: Observable<ChatMessage>): Observable<ChatMessage> {
 *     return request.pipe(
 *       // Process each incoming message
 *       switchMap(message => {
 *         // Broadcast to other users and return responses
 *         return this.chatService.broadcastMessage(message);
 *       })
 *     );
 *   }
 * }
 * ```
 */
export function GrpcStream(methodNameOrOptions?: string | GrpcMethodOptions): MethodDecorator {
    const options: GrpcMethodOptions =
        typeof methodNameOrOptions === 'string'
            ? { methodName: methodNameOrOptions, streaming: true }
            : { ...methodNameOrOptions, streaming: true };

    return (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
        if (!descriptor || typeof descriptor.value !== 'function') {
            throw new Error('@GrpcStream can only be applied to methods');
        }

        // If no method name is provided, use the method name
        options.methodName ??= key.toString();

        if (!options.methodName || options.methodName.trim().length === 0) {
            throw new Error('Method name cannot be empty');
        }

        // Ensure streaming is always true for GrpcStream
        options.streaming = true;

        // Ensure metadata is applied to the prototype, not the constructor
        Reflect.defineMetadata(GRPC_METHOD_METADATA, options, target, key);

        return descriptor;
    };
}
