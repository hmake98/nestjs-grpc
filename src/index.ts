import 'reflect-metadata';

// Main module
export { GrpcModule } from './grpc.module';

// Constants
export { GrpcErrorCode } from './constants';

// Decorators
export { GrpcController, GrpcMethod } from './decorators';

// Exceptions
export { GrpcException } from './exceptions/grpc.exception';

// Interfaces
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
// Note: Consumer functionality removed - use GrpcClientService directly
export {
    GrpcConsumerErrorHandler,
    GrpcConsumerException,
    getGrpcStatusDescription,
    httpStatusToGrpcStatus,
    RETRYABLE_STATUS_CODES,
} from './exceptions/grpc.exception';

// CLI commands (for programmatic usage)
export { generateCommand } from './commands/generate.command';
