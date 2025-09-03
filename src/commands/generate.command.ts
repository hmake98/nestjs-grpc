import { existsSync, statSync, mkdirSync, writeFileSync, accessSync, constants } from 'fs';
import { dirname, basename, join, resolve } from 'path';

import { globSync } from 'glob';
import * as protobuf from 'protobufjs';

import { generateTypeDefinitions } from '../utils';
import { GrpcLogger } from '../utils/logger';

import type { GenerateCommandOptions } from '../interfaces';

/**
 * Logger for generate command
 */
const logger = new GrpcLogger({
    context: 'GenerateCommand',
    level: 'log',
});

/**
 * Validates command options
 */
function validateOptions(options: GenerateCommandOptions): void {
    logger.debug(`Validating command options: proto=${options.proto}, output=${options.output}`);

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

    logger.debug('Command options validation completed');
}

/**
 * Normalizes proto path for directory inputs
 */
function normalizeProtoPath(protoPath: string, silent: boolean): string {
    try {
        if (!existsSync(protoPath)) {
            return protoPath; // Let findProtoFiles handle non-existent paths
        }

        const stats = statSync(protoPath);

        if (!stats.isFile() && !stats.isDirectory()) {
            throw new Error(`Proto path must be a file or directory: ${protoPath}`);
        }

        const isDirectory = stats.isDirectory();

        if (isDirectory && !protoPath.endsWith('/**/*.proto')) {
            const normalizedPath = protoPath.endsWith('/') ? protoPath : `${protoPath}/`;
            const result = `${normalizedPath}**/*.proto`;

            if (!silent) {
                logger.lifecycle('Directory detected, using pattern', { pattern: result });
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
        logger.debug(`Finding proto files with pattern: ${pattern}`);

        const files = globSync(pattern, {
            ignore: ['node_modules/**', '**/node_modules/**'],
            absolute: true,
            nodir: true,
        });

        logger.debug(`Found ${files.length} proto files`);

        // Validate that found files actually exist and are readable
        const validFiles = files.filter(file => {
            try {
                accessSync(file, constants.R_OK);
                return true;
            } catch {
                logger.warn(`Warning: Cannot read proto file: ${file}`);
                return false;
            }
        });

        logger.debug(`Valid proto files: ${validFiles.length}/${files.length}`);

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
        packageFilter: options.packageFilter ?? undefined,
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
                logger.lifecycle('Creating directory', { path: outputDir });
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
        logger.debug(`Loading proto file: ${protoFile}`);

        // Verify file exists and is readable
        accessSync(protoFile, constants.R_OK);

        const root = await protobuf.load(protoFile);

        if (!root) {
            throw new Error('Proto file loaded but returned null');
        }

        logger.debug(`Successfully loaded proto file: ${protoFile}`);
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
        logger.debug(`Writing types to file: ${outputPath}`);

        // Ensure directory exists
        ensureOutputDirectory(outputPath, true);

        // Write file
        writeFileSync(outputPath, content, 'utf8');

        // Verify file was written
        if (!existsSync(outputPath)) {
            throw new Error('File was not created successfully');
        }

        logger.debug(`Successfully wrote types to file: ${outputPath}`);
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
    silent: boolean,
): Promise<void> {
    try {
        if (!silent) {
            logger.lifecycle('Processing proto file', { file: protoFile });
        }

        const outputFile = getOutputPath(protoFile, outputDir);

        // Load and validate proto file
        const root = await loadProtoFile(protoFile);

        // Generate TypeScript definitions
        const typeDefinitions = generateTypeDefinitions(root, typeOptions);

        if (!typeDefinitions || typeDefinitions.trim().length === 0) {
            logger.warn(`Warning: No type definitions generated for ${protoFile}`);
            return;
        }

        // Write to file
        writeTypesToFile(typeDefinitions, outputFile);

        if (!silent) {
            logger.lifecycle('Generated types successfully', {
                input: protoFile,
                output: outputFile,
            });
        }
    } catch (error) {
        // Log error and rethrow to indicate processing failure
        logger.error(`Error processing ${protoFile}`, error);
        throw error;
    }
}

/**
 * Main command to generate TypeScript definitions from proto files
 */
export async function generateCommand(options: GenerateCommandOptions): Promise<number | void> {
    try {
        // Validate input options
        validateOptions(options);

        // Normalize proto path
        const normalizedProtoPath = normalizeProtoPath(options.proto, Boolean(options.silent));

        // Find proto files
        const protoFiles = findProtoFiles(normalizedProtoPath);

        if (protoFiles.length === 0) {
            console.error(`No proto files found matching pattern: ${normalizedProtoPath}`);
            return 1;
        }

        if (!options.silent) {
            logger.lifecycle('Found proto files', { count: protoFiles.length });
        }

        // Create type generation options
        const typeOptions = createTypeOptions(options);

        // Ensure output directory exists
        ensureOutputDirectory(options.output, Boolean(options.silent));

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
            logger.lifecycle('Processing complete', {
                succeeded: processedCount,
                failed: errorCount,
            });
        }

        if (processedCount === 0) {
            console.error('No files were processed successfully');
            return 1;
        }

        if (errorCount > 0 && !options.silent) {
            logger.warn(`Warning: ${errorCount} files failed to process`);
        }

        return 0;
    } catch (error) {
        console.error(error.message);
        return 1;
    }
}
