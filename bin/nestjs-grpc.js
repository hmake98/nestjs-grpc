#!/usr/bin/env node

/**
 * NestJS gRPC CLI Binary
 * Entry point for the nestjs-grpc command line tool
 */

const fs = require('fs');
const path = require('path');

/**
 * Find and load the CLI module
 */
function findCliModule() {
    const possiblePaths = [
        // Common layout when compiled into dist/*
        path.join(__dirname, '..', 'cli', 'cli.js'),
        path.join(__dirname, '..', 'index.js'),
        // In some build setups (e.g. SWC/tsc into `dist/src`) the compiled
        // files live under `dist/src/...` rather than `dist/...`. Check both.
        path.join(__dirname, '..', 'src', 'cli', 'cli.js'),
        path.join(__dirname, '..', 'src', 'index.js'),
    ];

    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            return testPath;
        }
    }

    return null;
}

/**
 * Display helpful error message for missing CLI module
 */
function showBuildError() {
    console.error('❌ CLI module not found. Please build the package first:');
    console.error('   npm run build');
    console.error('');
    console.error('For local development:');
    console.error('   npm run dev');
}

/**
 * Handle fatal errors with minimal output
 */
function handleFatalError(error) {
    console.error('❌ CLI startup failed:', error.message);
    if (process.env.DEBUG) {
        console.error('Debug info:', {
            node: process.version,
            platform: process.platform,
            cwd: process.cwd(),
            binary: __filename,
        });
    }
}

/**
 * Main CLI initialization
 */
function main() {
    try {
        const cliPath = findCliModule();

        if (!cliPath) {
            showBuildError();
            process.exit(1);
        }

        // Load and run the CLI
        const cli = require(cliPath);

        // Call the initialization function
        if (cli.initializeCli && typeof cli.initializeCli === 'function') {
            cli.initializeCli();
        } else if (cli.run && typeof cli.run === 'function') {
            cli.run();
        } else {
            console.error('❌ CLI module does not export initializeCli or run function');
            process.exit(1);
        }
    } catch (error) {
        handleFatalError(error);
        process.exit(1);
    }
}

// Global error handlers
process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', reason => {
    console.error('❌ Unhandled rejection:', reason);
    process.exit(1);
});

// Start the CLI only if this script is the main module (prevents auto-run during tests)
if (require.main === module) {
    main();
}

// Export for tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports.findCliModule = findCliModule;
}
