import { existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, basename, join } from 'path';

import { globSync } from 'glob';
import * as protobuf from 'protobufjs';

import { generateTypeDefinitions } from 'src/utils';

import type { GenerateCommandOptions } from '../interfaces';

/**
 * Command to generate TypeScript definitions from proto files
 */
export async function generateCommand(options: GenerateCommandOptions): Promise<void> {
    try {
        // Check if proto is a directory without glob pattern
        const isDirectory = existsSync(options.proto) && statSync(options.proto).isDirectory();

        // If it's a directory and doesn't end with a glob pattern, add it
        if (isDirectory && !options.proto.endsWith('/**/*.proto')) {
            const normalizedPath = options.proto.endsWith('/')
                ? options.proto
                : `${options.proto}/`;

            options.proto = `${normalizedPath}**/*.proto`;
            if (!options.silent) {
                console.log(`Directory detected, using pattern: ${options.proto}`);
            }
        }

        const protoFiles = globSync(options.proto, { ignore: 'node_modules/**' });

        if (protoFiles.length === 0) {
            console.warn(`No proto files found matching pattern: ${options.proto}`);
            return;
        }

        if (!options.silent) {
            console.log(`Found ${protoFiles.length} proto file(s)`);
        }

        // Create type generation options from command options
        const typeOptions = {
            useClasses: options.classes || false,
            includeComments: options.comments !== false,
            packageFilter: options.packageFilter,
            includeClientInterfaces: !options.noClientInterfaces,
        };

        // Initial generation
        for (const protoFile of protoFiles) {
            await generateTypesForFile(protoFile, options.output, typeOptions, options.silent);
        }

        if (!options.silent) {
            console.log('Type generation completed successfully');
        }
    } catch (error) {
        console.error('Error generating types:', error);
        process.exit(1);
    }
}

/**
 * Generate types for a single proto file
 */
async function generateTypesForFile(
    protoFile: string,
    outputDir: string,
    typeOptions: any,
    silent: boolean = false,
): Promise<void> {
    try {
        const outputFile = getOutputPath(protoFile, outputDir);

        // Create output directory if it doesn't exist
        const outputDirPath = dirname(outputFile);
        if (!existsSync(outputDirPath)) {
            if (!silent) {
                console.log(`Creating directory: ${outputDirPath}`);
            }
            mkdirSync(outputDirPath, { recursive: true });
        }

        // Load the proto file
        if (!silent) {
            console.log(`Loading proto file: ${protoFile}`);
        }
        const root = await protobuf.load(protoFile);

        // Generate TypeScript interfaces
        if (!silent) {
            console.log(`Generating types for: ${protoFile}`);
        }
        const typeDefinitions = generateTypeDefinitions(root, typeOptions);

        // Write to file
        writeTypesToFile(typeDefinitions, outputFile);

        if (!silent) {
            console.log(`Generated types for ${protoFile} → ${outputFile}`);
        }
    } catch (error) {
        console.error(`Error processing ${protoFile}:`, error);
    }
}

/**
 * Get the output path for a proto file
 */
function getOutputPath(protoFile: string, outputDir: string): string {
    const baseName = basename(protoFile, '.proto');
    return join(outputDir, `${baseName}.ts`);
}

/**
 * Write type definitions to a file
 */
function writeTypesToFile(content: string, outputPath: string): void {
    try {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, content, 'utf8');
    } catch (error) {
        console.error(`Failed to write types to ${outputPath}:`, error);
        throw error;
    }
}
