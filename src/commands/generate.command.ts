import { existsSync, statSync, mkdirSync, writeFileSync, accessSync, constants } from 'fs';
import { dirname, basename, join, resolve } from 'path';

import { globSync } from 'glob';
import * as protobuf from 'protobufjs';

import { generateTypeDefinitions } from '../utils';

import type { GenerateCommandOptions } from '../interfaces';

/**
 * Validates command options
 */
function validateOptions(options: GenerateCommandOptions): void {
    if (!options.proto || typeof options.proto !== 'string') {
        throw new Error('Proto path is required and must be a string');
    }

    if (!options.output || typeof options.output !== 'string') {
        throw new Error('Output path is required and must be a string');
    }

    // Check if proto path exists (for direct files)
    if (!options.proto.includes('*') && !existsSync(options.proto)) {
        throw new Error(`Proto path does not exist: ${options.proto}`);
    }

    // Validate output directory permissions
    try {
        const outputDir = resolve(options.output);
        const parentDir = dirname(outputDir);

        if (existsSync(parentDir)) {
            accessSync(parentDir, constants.W_OK);
        }
    } catch {
        throw new Error(`Cannot write to output directory: ${options.output}`);
    }
}

/**
 * Normalizes proto path for directory inputs
 */
function normalizeProtoPath(protoPath: string, silent: boolean): string {
    try {
        const isDirectory = existsSync(protoPath) && statSync(protoPath).isDirectory();

        if (isDirectory && !protoPath.endsWith('/**/*.proto')) {
            const normalizedPath = protoPath.endsWith('/') ? protoPath : `${protoPath}/`;
            const result = `${normalizedPath}**/*.proto`;

            if (!silent) {
                console.log(`Directory detected, using pattern: ${result}`);
            }

            return result;
        }

        return protoPath;
    } catch (error) {
        throw new Error(`Error accessing proto path: ${error.message}`);
    }
}

/**
 * Safely finds proto files with validation
 */
function findProtoFiles(pattern: string): string[] {
    try {
        const files = globSync(pattern, {
            ignore: ['node_modules/**', '**/node_modules/**'],
            absolute: true,
            nodir: true,
        });

        // Validate that found files actually exist and are readable
        const validFiles = files.filter(file => {
            try {
                accessSync(file, constants.R_OK);
                return true;
            } catch {
                console.warn(`Warning: Cannot read proto file: ${file}`);
                return false;
            }
        });

        return validFiles;
    } catch (error) {
        throw new Error(`Error finding proto files: ${error.message}`);
    }
}

/**
 * Creates type generation options with validation
 */
function createTypeOptions(options: GenerateCommandOptions): any {
    return {
        useClasses: Boolean(options.classes),
        includeComments: options.comments !== false,
        packageFilter: options.packageFilter || undefined,
        includeClientInterfaces: !options.noClientInterfaces,
    };
}

/**
 * Safely creates output directory
 */
function ensureOutputDirectory(outputPath: string, silent: boolean): void {
    try {
        const outputDir = dirname(outputPath);

        if (!existsSync(outputDir)) {
            if (!silent) {
                console.log(`Creating directory: ${outputDir}`);
            }
            mkdirSync(outputDir, { recursive: true });
        }

        // Verify directory was created and is writable
        accessSync(outputDir, constants.W_OK);
    } catch (error) {
        throw new Error(`Failed to create output directory: ${error.message}`);
    }
}

/**
 * Safely loads and validates proto file
 */
async function loadProtoFile(protoFile: string): Promise<protobuf.Root> {
    try {
        // Verify file exists and is readable
        accessSync(protoFile, constants.R_OK);

        const root = await protobuf.load(protoFile);

        if (!root) {
            throw new Error('Proto file loaded but returned null');
        }

        return root;
    } catch (error) {
        if (error.message.includes('ENOENT')) {
            throw new Error(`Proto file not found: ${protoFile}`);
        }
        throw new Error(`Failed to load proto file ${protoFile}: ${error.message}`);
    }
}

/**
 * Safely writes content to file with validation
 */
function writeTypesToFile(content: string, outputPath: string): void {
    if (!content || typeof content !== 'string') {
        throw new Error('Invalid content to write');
    }

    try {
        // Ensure directory exists
        ensureOutputDirectory(outputPath, true);

        // Write file
        writeFileSync(outputPath, content, 'utf8');

        // Verify file was written
        if (!existsSync(outputPath)) {
            throw new Error('File was not created successfully');
        }
    } catch (error) {
        throw new Error(`Failed to write types to ${outputPath}: ${error.message}`);
    }
}

/**
 * Gets output file path with validation
 */
function getOutputPath(protoFile: string, outputDir: string): string {
    try {
        const baseName = basename(protoFile, '.proto');

        if (!baseName) {
            throw new Error(`Invalid proto file name: ${protoFile}`);
        }

        return join(outputDir, `${baseName}.ts`);
    } catch (error) {
        throw new Error(`Failed to determine output path: ${error.message}`);
    }
}

/**
 * Generate types for a single proto file with comprehensive error handling
 */
async function generateTypesForFile(
    protoFile: string,
    outputDir: string,
    typeOptions: any,
    silent: boolean = false,
): Promise<void> {
    try {
        if (!silent) {
            console.log(`Processing: ${protoFile}`);
        }

        const outputFile = getOutputPath(protoFile, outputDir);

        // Load and validate proto file
        const root = await loadProtoFile(protoFile);

        // Generate TypeScript definitions
        const typeDefinitions = generateTypeDefinitions(root, typeOptions);

        if (!typeDefinitions || typeDefinitions.trim().length === 0) {
            console.warn(`Warning: No type definitions generated for ${protoFile}`);
            return;
        }

        // Write to file
        writeTypesToFile(typeDefinitions, outputFile);

        if (!silent) {
            console.log(`Generated: ${protoFile} → ${outputFile}`);
        }
    } catch (error) {
        // Log error but don't throw to allow other files to process
        console.error(`Error processing ${protoFile}: ${error.message}`);
    }
}

/**
 * Main command to generate TypeScript definitions from proto files
 */
export async function generateCommand(options: GenerateCommandOptions): Promise<void> {
    try {
        // Validate input options
        validateOptions(options);

        // Normalize proto path
        const normalizedProtoPath = normalizeProtoPath(options.proto, Boolean(options.silent));

        // Find proto files
        const protoFiles = findProtoFiles(normalizedProtoPath);

        if (protoFiles.length === 0) {
            throw new Error(`No proto files found matching pattern: ${normalizedProtoPath}`);
        }

        if (!options.silent) {
            console.log(`Found ${protoFiles.length} proto file(s)`);
        }

        // Create type generation options
        const typeOptions = createTypeOptions(options);

        // Process each proto file
        let processedCount = 0;
        let errorCount = 0;

        for (const protoFile of protoFiles) {
            try {
                await generateTypesForFile(
                    protoFile,
                    options.output,
                    typeOptions,
                    Boolean(options.silent),
                );
                processedCount++;
            } catch {
                errorCount++;
            }
        }

        // Report results
        if (!options.silent) {
            console.log(`Processing complete: ${processedCount} succeeded, ${errorCount} failed`);
        }

        if (processedCount === 0) {
            throw new Error('No files were processed successfully');
        }

        if (errorCount > 0 && !options.silent) {
            console.warn(`Warning: ${errorCount} files failed to process`);
        }
    } catch (error) {
        console.error('Generation failed:', error.message);
        throw error;
    }
}
