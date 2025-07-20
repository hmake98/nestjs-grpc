import { GRPC_METHOD_METADATA } from '../constants';

import type { GrpcMethodOptions } from '../interfaces';

/**
 * Decorator that marks a method as a gRPC streaming service method handler.
 * Used on server-side controller methods to handle incoming gRPC streaming calls.
 *
 * @param methodNameOrOptions - The method name as defined in the proto file or options object
 *
 * @example
 * ```typescript
 * @GrpcController('DataService')
 * export class DataController {
 *   // Basic streaming method mapping
 *   @GrpcStream('GetDataStream')
 *   getDataStream(@GrpcStreamPayload() payload: DataStreamRequest): Observable<DataStreamResponse> {
 *     return this.dataService.getDataStream(payload);
 *   }
 *
 *   // Explicit method name mapping with timeout
 *   @GrpcStream({ methodName: 'UploadData', timeout: 60000 })
 *   uploadData(@GrpcStreamPayload() payload: Observable<UploadRequest>): Observable<UploadResponse> {
 *     return this.dataService.uploadData(payload);
 *   }
 *
 *   // Bidirectional streaming
 *   @GrpcStream('Chat')
 *   chat(@GrpcStreamPayload() payload: Observable<ChatMessage>): Observable<ChatResponse> {
 *     return this.chatService.handleChat(payload);
 *   }
 * }
 * ```
 */
export function GrpcStream(methodNameOrOptions?: string | GrpcMethodOptions): MethodDecorator {
    const options: GrpcMethodOptions =
        typeof methodNameOrOptions === 'string'
            ? { methodName: methodNameOrOptions }
            : (methodNameOrOptions ?? {});

    return (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
        if (!descriptor || typeof descriptor.value !== 'function') {
            throw new Error('@GrpcStream can only be applied to methods');
        }

        // If no method name is provided, use the method name
        options.methodName ??= key.toString();

        if (!options.methodName || options.methodName.trim().length === 0) {
            throw new Error('Method name cannot be empty');
        }

        // Mark as streaming method
        options.streaming = true;

        // Ensure metadata is applied to the prototype, not the constructor
        Reflect.defineMetadata(GRPC_METHOD_METADATA, options, target, key);

        return descriptor;
    };
}
