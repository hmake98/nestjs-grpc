#!/usr/bin/env node

// More robust ESM detection using the Node.js package type
// This approach checks the type from package.json or uses dynamic import detection

(async () => {
    try {
        // First try to determine if we're in an ESM context
        // Strategy 1: Check for import.meta which only exists in ESM
        const isEsm = typeof import.meta !== 'undefined';

        if (isEsm) {
            // ES Module approach
            const cli = await import('../dist/cli/cli.js');
            // If the module exports a default, use it, otherwise the module is self-executing
        } else {
            // CommonJS approach
            require('../dist/cli/cli');
        }
    } catch (error) {
        // Fallback in case the above detection fails
        console.error('Error starting CLI:', error.message);
        console.error('Trying fallback method...');

        try {
            // Try CommonJS as a fallback
            require('../dist/cli/cli');
        } catch (fallbackError) {
            console.error('Fatal error: Could not load CLI module:', fallbackError.message);
            process.exit(1);
        }
    }
})();