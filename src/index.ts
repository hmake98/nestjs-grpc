import 'reflect-metadata';

// Main module
export { GrpcModule } from './grpc.module';

// Constants
export { GrpcErrorCode, RETRYABLE_STATUS_CODES, TYPE_MAPPING } from './constants';

// Decorators
export {
    GrpcController,
    GrpcMethod,
    GrpcService,
    GrpcPayload,
    GrpcStream,
    GrpcStreamPayload,
} from './decorators';

// Exceptions
export { GrpcException } from './exceptions/grpc.exception';

// Interfaces & Types
export { GrpcLogLevel } from './utils/enums';
export type {
    GrpcOptions,
    GrpcClientOptions,
    GrpcModuleAsyncOptions,
    GrpcOptionsFactory,
    GrpcFeatureOptions,
    GrpcMethodOptions,
    GrpcControllerOptions,
    GrpcServiceOptions,
    GrpcExceptionOptions,
    GrpcLoggingOptions,
    GenerateCommandOptions,
    ControllerMetadata,
    ServiceClientMetadata,
    GrpcErrorResponse,
    GrpcErrorDetails,
    HttpToGrpcStatusMapping,
    GrpcConsumerOptions,
    GrpcConsumerOptionsFactory,
    GrpcConsumerModuleAsyncOptions,
    GrpcConsumerMethodOptions,
    GrpcConsumerError,
} from './interfaces';

// Services
export { GrpcClientService } from './services/grpc-client.service';
export { GrpcRegistryService } from './services/grpc-registry.service';
export { GrpcProviderService } from './services/grpc-provider.service';
export { GrpcProtoService } from './services/grpc-proto.service';

// Utils
export { GrpcLogger } from './utils/logger';

// Consumer functionality
export {
    GrpcConsumerErrorHandler,
    GrpcConsumerException,
    getGrpcStatusDescription,
    httpStatusToGrpcStatus,
} from './exceptions/grpc.exception';

// CLI commands (for programmatic usage)
export { generateCommand } from './commands/generate.command';
