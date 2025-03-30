import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { GRPC_OPTIONS, GRPC_LOGGER } from '../constants';
import { GrpcOptions } from '../interfaces/grpc-options.interface';
import { GrpcLogger } from '../interfaces/logger.interface';
import { loadProtoWithProtobuf, generateTypeDefinitions, TypeOptions } from '../utils';

@Injectable()
export class TypeGeneratorService {
    constructor(
        @Inject(GRPC_OPTIONS) private readonly options: GrpcOptions,
        @Inject(GRPC_LOGGER) private readonly logger: GrpcLogger,
    ) {}

    /**
     * Generates TypeScript type definitions from the proto file
     * @param outputPath The output file path
     * @param options Options for generation
     * @returns Promise that resolves when types are generated
     */
    async generateTypes(outputPath: string, options?: TypeOptions): Promise<void> {
        const { protoPath } = this.options;

        try {
            this.logger.info(
                `Generating types from ${protoPath} to ${outputPath}`,
                'TypeGeneratorService',
            );

            // Load the proto file
            this.logger.debug('Loading proto file with protobufjs', 'TypeGeneratorService');
            const root = await loadProtoWithProtobuf(protoPath);

            // Generate TypeScript interfaces
            this.logger.debug('Generating TypeScript definitions', 'TypeGeneratorService');
            const typeDefinitions = generateTypeDefinitions(root, {
                includeComments: true,
                ...options,
            });

            // Write to file
            this.writeTypesToFile(typeDefinitions, outputPath);

            this.logger.info(
                `Successfully generated types to ${outputPath}`,
                'TypeGeneratorService',
            );
        } catch (error) {
            this.logger.error(
                `Failed to generate types: ${error.message}`,
                'TypeGeneratorService',
                error.stack,
            );
            throw new Error(`Failed to generate types: ${error.message}`);
        }
    }

    /**
     * Writes content to a file, creating directories if needed
     * @param content The content to write
     * @param outputPath The output file path
     */
    private writeTypesToFile(content: string, outputPath: string): void {
        try {
            const outputDir = path.dirname(outputPath);

            // Create directory if it doesn't exist
            if (!fs.existsSync(outputDir)) {
                this.logger.debug(
                    `Creating output directory: ${outputDir}`,
                    'TypeGeneratorService',
                );
                fs.mkdirSync(outputDir, { recursive: true });
            }

            this.logger.debug(`Writing types to file: ${outputPath}`, 'TypeGeneratorService');
            fs.writeFileSync(outputPath, content, 'utf8');
        } catch (error) {
            this.logger.error(
                `Failed to write types to file: ${error.message}`,
                'TypeGeneratorService',
                error.stack,
            );
            throw new Error(`Failed to write types to file: ${error.message}`);
        }
    }

    /**
     * Watches the proto file for changes and regenerates types
     * @param outputPath The output file path
     * @param options Options for generation
     */
    async watchProtoFile(outputPath: string, options?: TypeOptions): Promise<() => void> {
        const { protoPath } = this.options;

        // Generate types initially
        await this.generateTypes(outputPath, options);

        this.logger.info(`Watching ${protoPath} for changes...`, 'TypeGeneratorService');

        // Set up file watcher
        const watcher = fs.watch(protoPath, async () => {
            this.logger.info(`Proto file changed, regenerating types...`, 'TypeGeneratorService');
            try {
                await this.generateTypes(outputPath, options);
                this.logger.info(`Types regenerated successfully`, 'TypeGeneratorService');
            } catch (error) {
                this.logger.error(
                    `Error regenerating types: ${error.message}`,
                    'TypeGeneratorService',
                    error.stack,
                );
            }
        });

        // Return a function to stop watching
        return () => {
            watcher.close();
            this.logger.info(`Stopped watching proto file`, 'TypeGeneratorService');
        };
    }
}
