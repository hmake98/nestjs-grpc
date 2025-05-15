import eslintConfigPrettier from 'eslint-config-prettier';
import tsEsLintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import tsEslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

// Combine recommended rules from typescript-eslint
const rules = tsEslint.configs.recommended
    .map(config => config.rules)
    .filter(rules => rules !== undefined)
    .reduce((a, b) => ({ ...b, ...a }), {});

export default [
    eslintConfigPrettier,
    {
        ignores: [
            '.github/*',
            '.husky/*',
            'coverage/*',
            'dist/*',
            'docs/*',
            'node_modules/*',
        ],
    },
    {
        // Base config for all TypeScript files
        name: 'ts/default',
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: tsParser,
            parserOptions: {
                project: 'tsconfig.json',
                tsconfigRootDir: '.',
            },
        },
        linterOptions: {
            noInlineConfig: false,  // Allow inline disabling of rules
            reportUnusedDisableDirectives: true,
        },
        plugins: {
            '@typescript-eslint': tsEsLintPlugin,
            'import': importPlugin,
        },
        rules: {
            ...rules,
            // TypeScript-specific rules
            '@typescript-eslint/no-explicit-any': 'off',  // Allow any type for flexibility in library
            '@typescript-eslint/explicit-module-boundary-types': 'warn',  // Encourage type safety at public API boundaries
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
            '@typescript-eslint/ban-types': 'warn',  // Avoid problematic types like {}
            '@typescript-eslint/no-misused-promises': 'error',  // Prevent common promise handling errors
            '@typescript-eslint/no-floating-promises': 'error',  // Require handling of promises

            // Code style and quality rules
            'no-console': ['warn', { allow: ['warn', 'error'] }],  // Avoid console.log in production code
            'no-duplicate-imports': 'error',
            'no-return-await': 'warn',  // Redundant return await
            'no-undef': 'off',  // TypeScript handles this

            // Import organization
            'import/order': [
                'warn',
                {
                    'groups': [
                        'builtin',
                        'external',
                        'internal',
                        'parent',
                        'sibling',
                        'index'
                    ],
                    'newlines-between': 'always',
                    'alphabetize': { order: 'asc' }
                }
            ],
            'import/no-duplicates': 'error',
        },
        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: 'tsconfig.json',
                },
            },
        },
    },
    {
        // Source code specific rules
        name: 'ts/source',
        files: ['src/**/*.ts'],
        excludedFiles: ['**/*.spec.ts', '**/__tests__/**/*'],
        rules: {
            // More strict rules for source code
            '@typescript-eslint/explicit-function-return-type': 'warn',  // Encourage return types
            '@typescript-eslint/explicit-member-accessibility': ['warn', { overrides: { constructors: 'no-public' } }],
            'no-magic-numbers': ['warn', { ignore: [-1, 0, 1] }],  // Discourage magic numbers
        },
    },
    {
        // Test file specific rules
        name: 'ts/test',
        files: ['src/**/*.spec.ts', 'src/**/__tests__/**/*.ts', 'test/**/*.ts'],
        rules: {
            // Relax rules for tests
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            'no-magic-numbers': 'off',
            'max-nested-callbacks': 'off',  // For deeply nested test cases
            '@typescript-eslint/no-non-null-assertion': 'off',  // Allow non-null assertions in tests
        },
    },
    {
        // gRPC specific rules
        name: 'ts/grpc',
        files: ['src/**/*.service.ts', 'src/**/*.controller.ts'],
        rules: {
            // Rules specific to gRPC service implementations
            '@typescript-eslint/explicit-function-return-type': 'error',  // Strict return type enforcement for services
            '@typescript-eslint/no-floating-promises': 'error',  // Critical for gRPC service implementations
            'no-throw-literal': 'error',  // Only throw Error instances, not literals
        }
    },
    {
        // Decorators have special handling
        name: 'ts/decorators',
        files: ['src/**/*.decorator.ts'],
        rules: {
            '@typescript-eslint/ban-types': 'off',  // Allow {} types in decorators
            '@typescript-eslint/explicit-function-return-type': 'off',  // Decorators often return non-specific types
        }
    },
];