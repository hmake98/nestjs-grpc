#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import process from 'process';
import { generateCommand } from './commands';

// Get package version using a more compatible approach
let packageVersion = '0.1.0';
try {
    // We'll use process.cwd() which is safe across module systems
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    packageVersion = packageJson.version || '0.1.0';
} catch {
    // Fallback to env var if available
    packageVersion = process.env.npm_package_version || '0.1.0';
}

const program = new Command();

program.name('nestjs-grpc').description('CLI tool for NestJS gRPC package').version(packageVersion);

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
    .action(generateCommand);

program.parse(process.argv);

// Display help by default if no command is provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
