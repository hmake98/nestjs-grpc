import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { GRPC_OPTIONS } from '../constants';
import { GrpcOptions } from '../interfaces/grpc-options.interface';
import { loadProtoWithProtobuf, generateTypeDefinitions, TypeOptions } from '../utils';

@Injectable()
export class TypeGeneratorService {
    private readonly logger = new Logger(TypeGeneratorService.name);

    constructor(@Inject(GRPC_OPTIONS) private readonly options: GrpcOptions) {}

    /**
     * Generates TypeScript type definitions from the proto file
     * @param outputPath The output file path
     * @param options Options for generation
     * @returns Promise that resolves when types are generated
     */
    async generateTypes(outputPath: string, options?: TypeOptions): Promise<void> {
        const { protoPath } = this.options;

        try {
            this.logger.log(`Generating types from ${protoPath} to ${outputPath}`);

            // Load the proto file
            const root = await loadProtoWithProtobuf(protoPath);

            // Generate TypeScript interfaces
            const typeDefinitions = generateTypeDefinitions(root, {
                includeComments: true,
                ...options,
            });

            // Write to file
            this.writeTypesToFile(typeDefinitions, outputPath);

            this.logger.log(`Successfully generated types to ${outputPath}`);
        } catch (error) {
            this.logger.error(`Failed to generate types: ${error.message}`);
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
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(outputPath, content, 'utf8');
        } catch (error) {
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

        this.logger.log(`Watching ${protoPath} for changes...`);

        // Set up file watcher
        const watcher = fs.watch(protoPath, async () => {
            this.logger.log(`Proto file changed, regenerating types...`);
            try {
                await this.generateTypes(outputPath, options);
                this.logger.log(`Types regenerated successfully`);
            } catch (error) {
                this.logger.error(`Error regenerating types: ${error.message}`);
            }
        });

        // Return a function to stop watching
        return () => {
            watcher.close();
            this.logger.log(`Stopped watching proto file`);
        };
    }
}
