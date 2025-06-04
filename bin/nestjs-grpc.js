#!/usr/bin/env node

// Streamlined CLI binary with better error handling and validation
const fs = require('fs');
const path = require('path');

function validateEnvironment() {
    const distPath = path.join(__dirname, '..', 'dist');
    const cliPath = path.join(distPath, 'cli', 'cli.js');

    if (!fs.existsSync(distPath)) {
        console.error('Error: Package not built. Run "npm run build" first.');
        process.exit(1);
    }

    if (!fs.existsSync(cliPath)) {
        console.error('Error: CLI module not found. Run "npm run build" first.');
        process.exit(1);
    }

    return cliPath;
}

function startCli() {
    try {
        const cliPath = validateEnvironment();
        require(cliPath);
    } catch (error) {
        console.error('Fatal error:', error.message);
        console.error('Please reinstall the package or run "npm run build"');
        process.exit(1);
    }
}

// Graceful error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});

startCli();