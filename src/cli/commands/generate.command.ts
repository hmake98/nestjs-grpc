import { existsSync, statSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { dirname, basename, join } from 'path';
import { globSync } from 'glob';
import chalk from 'chalk';
import * as protobuf from 'protobufjs';
import { watch } from 'chokidar';
import { generateTypeDefinitions, TypeOptions } from 'src/utils';

interface GenerateCommandOptions {
    proto: string;
    output: string;
    watch: boolean;
    recursive?: boolean;
    classes?: boolean;
    comments?: boolean;
    packageFilter?: string;
}

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
            console.log(chalk.blue(`Directory detected, using pattern: ${options.proto}`));
        }

        const protoFiles = globSync(options.proto, { ignore: 'node_modules/**' });

        if (protoFiles.length === 0) {
            console.log(chalk.yellow(`No proto files found matching pattern: ${options.proto}`));
            return;
        }

        console.log(chalk.blue(`Found ${protoFiles.length} proto file(s)`));

        // Create type generation options from command options
        const typeOptions: TypeOptions = {
            useClasses: options.classes || false,
            includeComments: options.comments !== false,
            packageFilter: options.packageFilter,
        };

        // Initial generation
        for (const protoFile of protoFiles) {
            await generateTypesForFile(protoFile, options.output, typeOptions);
        }

        // Setup watch mode if requested
        if (options.watch) {
            console.log(chalk.blue('\nWatching for changes...'));

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
                    console.log(chalk.green(`File added: ${filePath}`));
                    await generateTypesForFile(filePath, options.output, typeOptions);
                }
            });

            watcher.on('change', async filePath => {
                if (filePath.endsWith('.proto')) {
                    console.log(chalk.green(`File changed: ${filePath}`));
                    await generateTypesForFile(filePath, options.output, typeOptions);
                }
            });

            watcher.on('unlink', filePath => {
                if (filePath.endsWith('.proto')) {
                    const outputFile = getOutputPath(filePath, options.output);
                    if (existsSync(outputFile)) {
                        unlinkSync(outputFile);
                        console.log(chalk.yellow(`Removed generated file: ${outputFile}`));
                    }
                }
            });

            console.log(chalk.blue('Press Ctrl+C to stop watching'));
            // Keep process alive
            process.stdin.resume();
        }
    } catch (error) {
        console.error(chalk.red('Error generating types:'), error);
        process.exit(1);
    }
}

async function generateTypesForFile(
    protoFile: string,
    outputDir: string,
    typeOptions: TypeOptions,
): Promise<void> {
    try {
        const outputFile = getOutputPath(protoFile, outputDir);

        // Create output directory if it doesn't exist
        const outputDirPath = dirname(outputFile);
        if (!existsSync(outputDirPath)) {
            mkdirSync(outputDirPath, { recursive: true });
        }

        // Load the proto file
        const root = await protobuf.load(protoFile);

        // Generate TypeScript interfaces
        const typeDefinitions = generateTypeDefinitions(root, typeOptions);

        // Write to file
        writeTypesToFile(typeDefinitions, outputFile);

        console.log(chalk.green(`Generated types for ${protoFile} → ${outputFile}`));
    } catch (error) {
        console.error(chalk.red(`Error processing ${protoFile}:`), error);
    }
}

function getOutputPath(protoFile: string, outputDir: string): string {
    const baseName = basename(protoFile, '.proto');
    return join(outputDir, `${baseName}.ts`);
}

function writeTypesToFile(content: string, outputPath: string): void {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, 'utf8');
}
