#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as chalk from 'chalk';
import { generateCommand } from './commands/generate.command';

const program = new Command();

program
    .name('nestjs-grpc')
    .description('CLI tool for NestJS gRPC package')
    .version(process.env.npm_package_version || '0.1.0');

program
    .command('generate')
    .description('Generate TypeScript definitions from protobuf files')
    .option('-p, --proto <pattern>', 'Pattern to match proto files', './protos/**/*.proto')
    .option('-o, --output <dir>', 'Output directory for generated files', './src/generated')
    .option('-w, --watch', 'Watch mode for file changes', false)
    .action(generateCommand);

program.parse(process.argv);

// Display help by default if no command is provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
