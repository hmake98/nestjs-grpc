#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join } from 'path';
import process from 'process';

import { Command } from 'commander';

import { generateCommand } from '../commands';

// Get package version - simple approach that works with CommonJS compilation
let packageVersion = '1.1.3'; // Default fallback to current version

try {
    // When compiled to CommonJS, __dirname will be available
    // Go up two levels: from dist/cli to root
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    packageVersion = packageJson.version || packageVersion;
} catch (error) {
    // Fallback to environment variable or keep default
    packageVersion = process.env.npm_package_version || packageVersion;
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
