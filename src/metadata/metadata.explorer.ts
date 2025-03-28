import { Injectable } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Metadata } from '@grpc/grpc-js';
import { GRPC_SERVICE_METADATA, GRPC_METHOD_METADATA } from '../constants';

interface MetadataParam {
    index: number;
    key?: string;
}

export const GRPC_METADATA_PARAM = 'grpc:metadata_param';

@Injectable()
export class GrpcMetadataExplorer {
    constructor(
        private readonly modulesContainer: ModulesContainer,
        private readonly metadataScanner: MetadataScanner,
    ) {}

    /**
     * Explores all controllers to find gRPC metadata parameters
     */
    explore(): Map<string, Map<string, MetadataParam[]>> {
        const controllers = this.getAllControllers();
        const metadataMap = new Map<string, Map<string, MetadataParam[]>>();

        controllers.forEach(wrapper => {
            const { instance, metatype } = wrapper;

            if (!instance || !metatype) {
                return;
            }

            // Check if this is a gRPC service
            const grpcServiceMetadata = Reflect.getMetadata(GRPC_SERVICE_METADATA, metatype);
            if (!grpcServiceMetadata) {
                return;
            }

            const controllerKey = metatype.name;
            const instanceProto = Object.getPrototypeOf(instance);
            const methodMetadataMap = new Map<string, MetadataParam[]>();

            this.metadataScanner.scanFromPrototype(
                instance,
                instanceProto,
                (methodName: string) => {
                    // Check if this is a gRPC method
                    const grpcMethodMetadata = Reflect.getMetadata(
                        GRPC_METHOD_METADATA,
                        instance,
                        methodName,
                    );

                    if (grpcMethodMetadata) {
                        // Find metadata params
                        const metadataParams: MetadataParam[] = this.getMetadataParams(
                            instance,
                            methodName,
                        );
                        if (metadataParams.length > 0) {
                            methodMetadataMap.set(methodName, metadataParams);
                        }
                    }
                },
            );

            if (methodMetadataMap.size > 0) {
                metadataMap.set(controllerKey, methodMetadataMap);
            }
        });

        return metadataMap;
    }

    /**
     * Gets all controllers from the modules container
     */
    private getAllControllers(): InstanceWrapper[] {
        const modules = [...this.modulesContainer.values()];
        return modules
            .filter(module => module.controllers.size > 0)
            .flatMap(module => [...module.controllers.values()]);
    }

    /**
     * Gets metadata parameters for a method
     */
    private getMetadataParams(instance: object, methodName: string): MetadataParam[] {
        const metadataParams = Reflect.getMetadata(GRPC_METADATA_PARAM, instance, methodName) || [];

        return metadataParams;
    }

    /**
     * Extracts metadata value for a parameter
     */
    extractMetadataValue(metadata: Metadata, param: MetadataParam): any {
        // If no specific key was requested, return the whole metadata object
        if (!param.key) {
            return metadata;
        }

        // Return the specific metadata value
        const values = metadata.get(param.key);
        if (values.length === 0) {
            return undefined;
        }

        // If there's a single value, return it directly
        if (values.length === 1) {
            return values[0].toString();
        }

        // Otherwise return all values as an array
        return values.map(v => v.toString());
    }
}
