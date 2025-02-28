import { ModuleMetadata, Type } from '@nestjs/common';
import { GrpcOptions } from './grpc-options.interface';

/**
 * Factory for creating gRPC options
 */
export interface GrpcOptionsFactory {
    createGrpcOptions(): Promise<GrpcOptions> | GrpcOptions;
}

/**
 * Async options for the gRPC module
 */
export interface GrpcModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    /**
     * Injection token for the module
     */
    useExisting?: Type<GrpcOptionsFactory>;

    /**
     * Factory class for creating options
     */
    useClass?: Type<GrpcOptionsFactory>;

    /**
     * Factory function for creating options
     */
    useFactory?: (...args: any[]) => Promise<GrpcOptions> | GrpcOptions;

    /**
     * Dependencies for the factory function
     */
    inject?: any[];
}
