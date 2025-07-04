// Main module
export * from './grpc.module';

// Constants
export { GrpcErrorCode } from './constants';

// Decorators
export * from './decorators/grpc-method.decorator';
export * from './decorators/grpc-service.decorator';
export * from './decorators/grpc-controller.decorator';

// Exceptions
export * from './exceptions/grpc.exception';
export * from './exceptions/grpc.exception-filter';

// Interfaces
export * from './interfaces';

// Export the specific interface for better IDE support
export type { GrpcFeatureOptions } from './interfaces';

// Services
export * from './services/grpc-client.service';
export * from './services/proto-loader.service';

// Utils
export * from './utils/proto-utils';
export * from './utils/type-utils';
export * from './utils/logger';

// CLI commands
export * from './commands/generate.command';
