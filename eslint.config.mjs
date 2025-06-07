import eslintConfigPrettier from 'eslint-config-prettier';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: {},
});

// Base TypeScript rules with enhancements for NestJS
const baseTypeScriptRules = {
    // TypeScript specific rules
    '@typescript-eslint/no-explicit-any': 'off', // Allow any for gRPC flexibility
    '@typescript-eslint/no-unused-vars': [
        'warn',
        {
            args: 'all',
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            ignoreRestSiblings: true,
        },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/ban-ts-comment': [
        'error',
        {
            'ts-expect-error': 'allow-with-description',
            'ts-ignore': 'allow-with-description',
            'ts-nocheck': 'allow-with-description',
            'ts-check': false,
            minimumDescriptionLength: 5,
        },
    ],

    // General JavaScript/TypeScript rules
    'no-unused-vars': 'off', // Use TypeScript version instead
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'no-throw-literal': 'error',
    'prefer-template': 'error',
    'object-shorthand': 'error',
    'no-duplicate-imports': 'error',

    // Import rules
    'import/order': [
        'error',
        {
            groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
            'newlines-between': 'always',
            alphabetize: {
                order: 'asc',
                caseInsensitive: true,
            },
        },
    ],
    'import/no-unresolved': 'error',
    'import/no-cycle': 'error',
    'import/no-unused-modules': 'warn',
    'import/no-deprecated': 'warn',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',

    // Prettier integration
    'prettier/prettier': [
        'error',
        {
            singleQuote: true,
            trailingComma: 'all',
            printWidth: 100,
            tabWidth: 4,
            semi: true,
            bracketSpacing: true,
            arrowParens: 'avoid',
            endOfLine: 'lf',
        },
    ],
};

// Base configuration for TypeScript files
const baseTypeScriptConfig = {
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: tsParser,
        parserOptions: {
            project: './tsconfig.json',
            tsconfigRootDir: __dirname,
            ecmaFeatures: {
                jsx: false,
            },
        },
        globals: {
            NodeJS: 'readonly',
            Buffer: 'readonly',
            process: 'readonly',
            console: 'readonly',
            __dirname: 'readonly',
            __filename: 'readonly',
            module: 'readonly',
            require: 'readonly',
            exports: 'readonly',
            global: 'readonly',
        },
    },
    plugins: {
        '@typescript-eslint': tsEslintPlugin,
        import: importPlugin,
        prettier: prettierPlugin,
    },
    settings: {
        'import/resolver': {
            typescript: {
                alwaysTryTypes: true,
                project: './tsconfig.json',
            },
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
            },
        },
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
    },
    rules: baseTypeScriptRules,
};

export default [
    // Prettier config should come first
    eslintConfigPrettier,

    // Global ignores
    {
        ignores: [
            '.github/**/*',
            '.husky/**/*',
            'coverage/**/*',
            'dist/**/*',
            'docs/**/*',
            'node_modules/**/*',
            '**/*.min.js',
            '**/*.bundle.js',
            'bin/nestjs-grpc.js', // Ignore the binary file
        ],
    },

    // Source TypeScript files - strict configuration
    {
        name: 'typescript/src',
        files: ['src/**/*.ts'],
        ...baseTypeScriptConfig,
        linterOptions: {
            reportUnusedDisableDirectives: true,
            noInlineConfig: true,
        },
        rules: {
            ...baseTypeScriptRules,
            // Additional strict rules for source code
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/require-await': 'warn',
            'no-return-await': 'off',
            '@typescript-eslint/return-await': 'error',
        },
    },

    // CLI files - slightly relaxed rules
    {
        name: 'typescript/cli',
        files: ['src/cli/**/*.ts', 'src/commands/**/*.ts'],
        ...baseTypeScriptConfig,
        rules: {
            ...baseTypeScriptRules,
            'no-console': 'off', // Allow console in CLI
            '@typescript-eslint/no-floating-promises': 'warn',
            'import/no-unused-modules': 'off', // CLI modules might be used externally
        },
    },

    // Test files - most relaxed rules
    {
        name: 'typescript/test',
        files: ['test/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
        ...baseTypeScriptConfig,
        linterOptions: {
            reportUnusedDisableDirectives: true,
            noInlineConfig: false,
        },
        rules: {
            ...baseTypeScriptRules,
            // Relaxed rules for tests
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            'import/no-unused-modules': 'off',
            'no-console': 'off',
        },
    },

    // Configuration files
    {
        name: 'config-files',
        files: ['*.config.{js,mjs,cjs}', '*.js', '*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
            },
        },
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            'no-console': 'off',
            'no-undef': 'error',
            'prettier/prettier': 'error',
        },
    },

    // Binary files - minimal rules
    {
        name: 'binary-files',
        files: ['bin/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script', // Binary files use CommonJS
            globals: {
                console: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
            },
        },
        rules: {
            'no-console': 'off',
            'no-undef': 'error',
            'no-unused-vars': 'warn',
        },
    },
];
