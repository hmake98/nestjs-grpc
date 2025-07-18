#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join } from 'path';
import process from 'process';

import { Command } from 'commander';

import { generateCommand } from '../commands';
import { GrpcLogger } from '../utils/logger';

/**
 * Logger for CLI
 */
const logger = new GrpcLogger({
    context: 'CLI',
    level: 'log',
});

/**
 * Safely read package version with fallback
 */
function getPackageVersion(): string {
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const packageContent = readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);

    return packageJson.version;
}

/**
 * Validate command arguments
 */
function validateArgs(): boolean {
    const args = process.argv.slice(2);

    // Allow help and version commands
    if (
        args.length === 0 ||
        args.includes('--help') ||
        args.includes('-h') ||
        args.includes('--version') ||
        args.includes('-V')
    ) {
        return true;
    }

    // Must have at least a command
    if (args.length === 0 || !['generate'].includes(args[0])) {
        return false;
    }

    return true;
}

/**
 * Setup graceful error handling
 */
function setupErrorHandling(): void {
    process.on('uncaughtException', error => {
        logger.error('Fatal error', error);
        process.exit(1);
    });

    process.on('unhandledRejection', reason => {
        logger.error(
            'Unhandled promise rejection',
            reason instanceof Error ? reason : String(reason),
        );
        process.exit(1);
    });

    process.on('SIGTERM', () => {
        logger.lifecycle('Received SIGTERM, shutting down gracefully');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.lifecycle('Received SIGINT, shutting down gracefully');
        process.exit(0);
    });
}

/**
 * Main CLI initialization
 */
function initializeCli(): void {
    setupErrorHandling();

    if (!validateArgs()) {
        logger.error('Error: Invalid arguments provided');
        process.exit(1);
    }

    const program = new Command();
    const version = getPackageVersion();

    logger.lifecycle('Initializing CLI', { version });

    program.name('nestjs-grpc').description('CLI tool for NestJS gRPC package').version(version);

    program
        .command('generate')
        .description('Generate TypeScript definitions from protobuf files')
        .option(
            '-p, --proto <pattern>',
            'Path to proto file, directory, or glob pattern',
            './protos/**/*.proto',
        )
        .option('-o, --output <dir>', 'Output directory for generated files', './src/generated')
        .option('-w, --watch', 'Watch mode for file changes', false)
        .option('-c, --classes', 'Generate classes instead of interfaces', false)
        .option('--no-comments', 'Disable comments in generated files')
        .option('--no-client-interfaces', 'Do not generate client interfaces')
        .option('-f, --package-filter <package>', 'Filter by package name')
        .option('-r, --recursive', 'Recursively search directories for .proto files', true)
        .option('-v, --verbose', 'Enable verbose logging')
        .option('-s, --silent', 'Disable all logging except errors')
        .action(async options => {
            try {
                logger.lifecycle('Starting generate command', {
                    proto: options.proto,
                    output: options.output,
                });
                await generateCommand(options);
                logger.lifecycle('Generate command completed successfully');
            } catch (error) {
                logger.error('Command failed', error instanceof Error ? error : String(error));
                process.exit(1);
            }
        });

    // Parse arguments and handle unknown commands
    try {
        program.parse(process.argv);

        // Show help if no command provided
        if (!process.argv.slice(2).length) {
            program.outputHelp();
        }
    } catch (error) {
        logger.error('Error parsing arguments', error instanceof Error ? error : String(error));
        process.exit(1);
    }
}

// Start the CLI
initializeCli();
