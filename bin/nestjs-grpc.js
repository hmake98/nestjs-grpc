#!/usr/bin/env node

/**
 * NestJS gRPC CLI Binary
 * This file is the entry point for the nestjs-grpc command line tool
 */

const fs = require('fs');
const path = require('path');

function findCliModule() {
    // Possible locations for the CLI module
    const possiblePaths = [
        path.join(__dirname, '..', 'cli', 'cli.js'),           // dist/cli/cli.js
        path.join(__dirname, '..', 'index.js'),                // dist/index.js
    ];

    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            return testPath;
        }
    }

    return null;
}

function main() {
    try {
        const cliPath = findCliModule();

        if (!cliPath) {
            console.error('Error: CLI module not found.');
            console.error('Please ensure the package is properly built with "npm run build"');
            console.error('');
            console.error('If you are developing this package locally:');
            console.error('  1. Run: npm run build');
            console.error('  2. Run: npm link');
            console.error('  3. Try the command again');
            process.exit(1);
        }

        // Import and run the CLI
        require(cliPath);
    } catch (error) {
        console.error('Fatal error starting CLI:', error.message);
        console.error('');
        console.error('Debug information:');
        console.error('  Node version:', process.version);
        console.error('  Platform:', process.platform);
        console.error('  Working directory:', process.cwd());
        console.error('  CLI binary location:', __filename);
        process.exit(1);
    }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});

// Start the CLI
main();