import { existsSync, statSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { dirname, basename, join } from 'path';
import { globSync } from 'glob';
import * as protobuf from 'protobufjs';
import { watch } from 'chokidar';
import { generateTypeDefinitions, TypeOptions } from '../../utils';
import { GrpcLoggerService } from '../../services/logger.service';
import { LogLevel } from '../../interfaces/logger.interface';

interface GenerateCommandOptions {
    proto: string;
    output: string;
    watch: boolean;
    recursive?: boolean;
    classes?: boolean;
    comments?: boolean;
    packageFilter?: string;
    verbose?: boolean;
    silent?: boolean;
    // Add new option to control client interface generation
    noClientInterfaces?: boolean;
}

export async function generateCommand(options: GenerateCommandOptions): Promise<void> {
    // Configure logger based on command line options
    const logLevel = options.verbose
        ? LogLevel.DEBUG
        : options.silent
          ? LogLevel.ERROR
          : LogLevel.INFO;

    const logger = new GrpcLoggerService('CliGenerator', {
        level: logLevel,
        prettyPrint: true,
        disable: options.silent === true,
    });

    try {
        // Check if proto is a directory without glob pattern
        const isDirectory = existsSync(options.proto) && statSync(options.proto).isDirectory();

        // If it's a directory and doesn't end with a glob pattern, add it
        if (isDirectory && !options.proto.endsWith('/**/*.proto')) {
            const normalizedPath = options.proto.endsWith('/')
                ? options.proto
                : `${options.proto}/`;

            options.proto = `${normalizedPath}**/*.proto`;
            logger.info(`Directory detected, using pattern: ${options.proto}`);
        }

        const protoFiles = globSync(options.proto, { ignore: 'node_modules/**' });

        if (protoFiles.length === 0) {
            logger.warn(`No proto files found matching pattern: ${options.proto}`);
            return;
        }

        logger.info(`Found ${protoFiles.length} proto file(s)`);

        // Create type generation options from command options
        const typeOptions: TypeOptions = {
            useClasses: options.classes || false,
            includeComments: options.comments !== false,
            packageFilter: options.packageFilter,
            // Set includeClientInterfaces to false if noClientInterfaces is true
            includeClientInterfaces: !options.noClientInterfaces,
        };

        // Initial generation
        for (const protoFile of protoFiles) {
            await generateTypesForFile(protoFile, options.output, typeOptions, logger);
        }

        // Setup watch mode if requested
        if (options.watch) {
            logger.info('\nWatching for changes...');

            const watchPatterns = isDirectory
                ? options.proto
                : protoFiles.map(file => dirname(file) + '/**/*.proto');

            const watcher = watch(watchPatterns, {
                persistent: true,
                ignoreInitial: true,
                ignorePermissionErrors: true,
                ignored: 'node_modules/**',
            });

            watcher.on('add', async filePath => {
                if (filePath.endsWith('.proto')) {
                    logger.info(`File added: ${filePath}`);
                    await generateTypesForFile(filePath, options.output, typeOptions, logger);
                }
            });

            watcher.on('change', async filePath => {
                if (filePath.endsWith('.proto')) {
                    logger.info(`File changed: ${filePath}`);
                    await generateTypesForFile(filePath, options.output, typeOptions, logger);
                }
            });

            watcher.on('unlink', filePath => {
                if (filePath.endsWith('.proto')) {
                    const outputFile = getOutputPath(filePath, options.output);
                    if (existsSync(outputFile)) {
                        unlinkSync(outputFile);
                        logger.info(`Removed generated file: ${outputFile}`);
                    }
                }
            });

            logger.info('Press Ctrl+C to stop watching');
            // Keep process alive
            process.stdin.resume();
        }
    } catch (error) {
        logger.error('Error generating types:', 'CliGenerator', error.stack);
        process.exit(1);
    }
}

async function generateTypesForFile(
    protoFile: string,
    outputDir: string,
    typeOptions: TypeOptions,
    logger: GrpcLoggerService,
): Promise<void> {
    try {
        const outputFile = getOutputPath(protoFile, outputDir);

        // Create output directory if it doesn't exist
        const outputDirPath = dirname(outputFile);
        if (!existsSync(outputDirPath)) {
            logger.debug(`Creating directory: ${outputDirPath}`);
            mkdirSync(outputDirPath, { recursive: true });
        }

        // Load the proto file
        logger.debug(`Loading proto file: ${protoFile}`);
        const root = await protobuf.load(protoFile);

        // Generate TypeScript interfaces
        logger.debug(`Generating types for: ${protoFile}`);
        const typeDefinitions = generateTypeDefinitions(root, typeOptions);

        // Write to file
        writeTypesToFile(typeDefinitions, outputFile, logger);

        logger.info(`Generated types for ${protoFile} → ${outputFile}`);
    } catch (error) {
        logger.error(`Error processing ${protoFile}:`, 'CliGenerator', error.stack);
    }
}

function getOutputPath(protoFile: string, outputDir: string): string {
    const baseName = basename(protoFile, '.proto');
    return join(outputDir, `${baseName}.ts`);
}

function writeTypesToFile(content: string, outputPath: string, logger: GrpcLoggerService): void {
    try {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, content, 'utf8');
        logger.debug(`Successfully wrote types to: ${outputPath}`);
    } catch (error) {
        logger.error(`Failed to write types to ${outputPath}:`, 'CliGenerator', error.stack);
        throw error;
    }
}
