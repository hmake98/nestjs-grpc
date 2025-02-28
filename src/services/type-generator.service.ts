import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as protobuf from 'protobufjs';
import { GRPC_OPTIONS } from '../constants';
import { GrpcOptions } from '../interfaces/grpc-options.interface';
import { loadProtoWithProtobuf, generateTypeDefinitions } from '../utils';

@Injectable()
export class TypeGeneratorService {
    constructor(@Inject(GRPC_OPTIONS) private readonly options: GrpcOptions) {}

    /**
     * Generates TypeScript type definitions from the proto file
     * @param outputPath The output file path
     * @returns Promise that resolves when types are generated
     */
    async generateTypes(outputPath: string): Promise<void> {
        const { protoPath } = this.options;

        try {
            // Load the proto file
            const root = await loadProtoWithProtobuf(protoPath);

            // Generate TypeScript interfaces
            const typeDefinitions = this.generateTypeDefinitions(root);

            // Write to file
            this.writeTypesToFile(typeDefinitions, outputPath);
        } catch (error) {
            throw new Error(`Failed to generate types: ${error.message}`);
        }
    }

    /**
     * Generates TypeScript definitions from a protobuf root
     * @param root The protobuf root
     * @returns The generated TypeScript definitions
     */
    private generateTypeDefinitions(root: protobuf.Root): string {
        return generateTypeDefinitions(root);
    }

    /**
     * Writes content to a file, creating directories if needed
     * @param content The content to write
     * @param outputPath The output file path
     */
    private writeTypesToFile(content: string, outputPath: string): void {
        try {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, content, 'utf8');
        } catch (error) {
            throw new Error(`Failed to write types to file: ${error.message}`);
        }
    }
}
