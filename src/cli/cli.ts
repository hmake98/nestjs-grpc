#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join } from 'path';
import process from 'process';

import { Command } from 'commander';

import { generateCommand } from '../commands';

/**
 * Safely read package version with fallback
 */
function getPackageVersion(): string {
    const fallbackVersion = '1.2.4';

    try {
        const packagePath = join(__dirname, '..', '..', 'package.json');
        const packageContent = readFileSync(packagePath, 'utf8');
        const packageJson = JSON.parse(packageContent);

        if (!packageJson.version || typeof packageJson.version !== 'string') {
            console.warn('Warning: Invalid version in package.json, using fallback');
            return fallbackVersion;
        }

        return packageJson.version;
    } catch {
        console.warn('Warning: Could not read package version, using fallback');
        return fallbackVersion;
    }
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
        console.error('Fatal error:', error.message);
        process.exit(1);
    });

    process.on('unhandledRejection', reason => {
        console.error('Unhandled promise rejection:', reason);
        process.exit(1);
    });

    process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down gracefully');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        console.log('Received SIGINT, shutting down gracefully');
        process.exit(0);
    });
}

/**
 * Main CLI initialization
 */
function initializeCli(): void {
    setupErrorHandling();

    if (!validateArgs()) {
        console.error('Error: Invalid arguments provided');
        process.exit(1);
    }

    const program = new Command();
    const version = getPackageVersion();

    program
        .name('nestjs-grpc')
        .description('CLI tool for NestJS gRPC package')
        .version(version)
        .helpOption('-h, --help', 'Display help for command');

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
                await generateCommand(options);
            } catch (error) {
                console.error('Command failed:', error.message);
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
        console.error('Error parsing arguments:', error.message);
        process.exit(1);
    }
}

// Start the CLI
initializeCli();
