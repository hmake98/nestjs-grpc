#!/usr/bin/env node

// Simple CommonJS approach for the CLI binary
// This avoids the import.meta issue by using a more straightforward detection method

(async () => {
    try {
        // Try to require the CLI module directly
        // This works for both CommonJS and most hybrid setups
        require('../dist/cli/cli');
    } catch (error) {
        // If the above fails, it might be because the dist folder doesn't exist
        // or there's a module resolution issue
        console.error('Error starting CLI:', error.message);

        // Check if the dist folder exists
        const fs = require('fs');
        const path = require('path');
        const distPath = path.join(__dirname, '..', 'dist');

        if (!fs.existsSync(distPath)) {
            console.error('The dist folder does not exist. Please build the package first:');
            console.error('  npm run build');
            process.exit(1);
        }

        // Check if the CLI file exists
        const cliPath = path.join(distPath, 'cli', 'cli.js');
        if (!fs.existsSync(cliPath)) {
            console.error('The CLI file does not exist at:', cliPath);
            console.error('Please build the package first:');
            console.error('  npm run build');
            process.exit(1);
        }

        console.error('Fatal error: Could not load CLI module');
        console.error('Please check the package installation and try rebuilding:');
        console.error('  npm run build');
        process.exit(1);
    }
})();