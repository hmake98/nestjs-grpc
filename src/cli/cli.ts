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
function validateArgs(argv: string[] = process.argv): boolean {
    const args = argv.slice(2);

    // Allow help and version commands
    if (
        args.includes('--help') ||
        args.includes('-h') ||
        args.includes('--version') ||
        args.includes('-V')
    ) {
        return true;
    }

    // If no args, allow (will show help)
    if (args.length === 0) {
        return true;
    }

    // Must be a valid command
    if (!['generate'].includes(args[0])) {
        return false;
    }

    return true;
}

// Store event listeners for cleanup
let eventListeners: { event: string; handler: (...args: any[]) => void }[] = [];

/**
 * Setup graceful error handling
 */
function setupErrorHandling(): void {
    const uncaughtHandler = (error: Error) => {
        logger.error('Fatal error', error);
        process.exit(1);
    };

    const rejectionHandler = (reason: any) => {
        logger.error(
            'Unhandled promise rejection',
            reason instanceof Error ? reason : String(reason),
        );
        process.exit(1);
    };

    const sigtermHandler = () => {
        logger.lifecycle('Received SIGTERM, shutting down gracefully');
        process.exit(0);
    };

    const sigintHandler = () => {
        logger.lifecycle('Received SIGINT, shutting down gracefully');
        process.exit(0);
    };

    process.on('uncaughtException', uncaughtHandler);
    process.on('unhandledRejection', rejectionHandler);
    process.on('SIGTERM', sigtermHandler);
    process.on('SIGINT', sigintHandler);

    // Store for cleanup
    eventListeners = [
        { event: 'uncaughtException', handler: uncaughtHandler },
        { event: 'unhandledRejection', handler: rejectionHandler },
        { event: 'SIGTERM', handler: sigtermHandler },
        { event: 'SIGINT', handler: sigintHandler },
    ];
}

/**
 * Cleanup function for tests
 */
export function cleanup(): void {
    eventListeners.forEach(({ event, handler }) => {
        process.removeListener(event, handler);
    });
    eventListeners = [];
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
                process.exit(0);
            } catch (error) {
                logger.error('Command failed', error instanceof Error ? error : String(error));
                process.exit(1);
            }
        });

    // Add unknown command handler
    program.on('command:*', () => {
        logger.error('Error: Invalid arguments provided');
        process.exit(1);
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

/**
 * Test seam: exporting run() does not change runtime behavior.
 * @param argv - Command line arguments to parse
 */
export function run(argv: string[] = process.argv): void {
    setupErrorHandling();

    if (!validateArgs(argv)) {
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
                process.exit(0);
            } catch (error) {
                logger.error('Command failed', error instanceof Error ? error : String(error));
                process.exit(1);
            }
        });

    // Add unknown command handler
    program.on('command:*', () => {
        logger.error('Error: Invalid arguments provided');
        process.exit(1);
    });

    // Parse arguments and handle unknown commands
    try {
        program.parse(argv);

        // Show help if no command provided
        if (!argv.slice(2).length) {
            program.outputHelp();
            process.exit(0);
        }
    } catch (error) {
        // Commander.js throws when --help or --version are used, which is expected
        // These should exit with code 0, not 1
        if (
            error instanceof Error &&
            (error.message.includes('help') ||
                error.message.includes('version') ||
                argv.includes('--help') ||
                argv.includes('-h') ||
                argv.includes('--version') ||
                argv.includes('-V'))
        ) {
            process.exit(0);
        } else {
            logger.error('Error parsing arguments', error instanceof Error ? error : String(error));
            process.exit(1);
        }
    }
}

// Export for testing
export { initializeCli };

// Start the CLI only if this module is the main module (not during testing)
if (require.main === module) {
    initializeCli();
}
