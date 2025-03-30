#!/usr/bin/env node

// Check if we're in an ES Module context or CommonJS
const isESM = typeof require === 'undefined';

if (isESM) {
    // ES Module approach
    import('../dist/cli/cli.js');
} else {
    // CommonJS approach
    require('../dist/cli/cli');
}