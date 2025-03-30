import { FlatCompat } from '@eslint/eslintrc';
import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert the URL to a file path (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create compatibility object to use with eslint v9
const compat = new FlatCompat({
    baseDirectory: __dirname,
});

export default [
    // Include the recommended configuration for TypeScript
    ...compat.extends(
        'plugin:@typescript-eslint/recommended',
    ),

    // Add Prettier config
    prettierConfig,

    {
        // Define global options
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: __dirname,
                sourceType: 'module',
            },
            ecmaVersion: 2022,
            globals: {
                // Define globals available in Node.js environment
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                // And Jest globals
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                jest: 'readonly',
                // Add node and jest environment globals
                // These replace the previous env settings
                node: 'readonly',
                module: 'readonly',
                require: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                Buffer: 'readonly',
                // Common Jest globals
                beforeAll: 'readonly',
                afterAll: 'readonly',
                test: 'readonly',
            },
        },

        // Include plugins
        plugins: {
            '@typescript-eslint': typescriptPlugin,
            'prettier': prettierPlugin,
        },

        // Define rules
        rules: {
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {
                'argsIgnorePattern': '^_',
                'varsIgnorePattern': '^_'
            }],
            'prettier/prettier': ['error', {
                'endOfLine': 'auto'
            }]
        },

        // Ignoring patterns
        ignores: [
            'eslint.config.js',
            'dist/**',
            'node_modules/**',
        ],
    },
];