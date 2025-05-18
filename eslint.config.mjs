import eslintConfigPrettier from 'eslint-config-prettier';
import tsEsLintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import tsEslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

// Improved rule merging with null checks
const rules = tsEslint.configs.recommended
    .map(config => config?.rules || {})
    .reduce((merged, current) => ({ ...merged, ...current }), {});

export default [
    eslintConfigPrettier,
    {
        ignores: [
            '.github/**/*',
            '.husky/**/*',
            'coverage/**/*',
            'dist/**/*',
            'docs/**/*',
            'node_modules/**/*',
        ],
    },
    {
        // Base config for all TypeScript files
        name: 'ts/default',
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            parser: tsParser,
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: '.',
            },
        },
        linterOptions: {
            noInlineConfig: false,
            reportUnusedDisableDirectives: true,
        },
        plugins: {
            '@typescript-eslint': tsEsLintPlugin,
            'import': importPlugin,
        },
        rules: {
            ...rules,
            // TypeScript-specific rules
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'warn',
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
            '@typescript-eslint/ban-types': 'warn',
            '@typescript-eslint/no-misused-promises': [
                'error',
                { checksVoidReturn: false }
            ],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
            '@typescript-eslint/no-import-type-side-effects': 'warn',

            // Code style and quality rules
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-duplicate-imports': 'off', // Using import/no-duplicates instead
            'no-return-await': 'off', // Using @typescript-eslint/return-await instead
            '@typescript-eslint/return-await': ['warn', 'never'],
            'no-undef': 'off', // TypeScript handles this

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
                        'index',
                        'object',
                        'type'
                    ],
                    'newlines-between': 'always',
                    'alphabetize': {
                        order: 'asc',
                        caseInsensitive: true
                    },
                    'pathGroups': [
                        {
                            pattern: '@nestjs/**',
                            group: 'external',
                            position: 'before'
                        }
                    ]
                }
            ],
            'import/no-duplicates': 'error',
            'import/no-unresolved': 'off', // TypeScript handles this
            'import/namespace': 'off', // Performance improvement
        },
        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: './tsconfig.json',
                },
            },
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts']
            }
        },
    },
    {
        // Source code specific rules
        name: 'ts/source',
        files: ['src/**/*.ts'],
        // Fixed: Using "notFiles" instead of "excludedFiles"
        notFiles: ['**/*.spec.ts', '**/__tests__/**/*'],
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/explicit-member-accessibility': [
                'warn',
                { overrides: { constructors: 'no-public' } }
            ],
            'no-magic-numbers': [
                'warn',
                {
                    ignore: [-1, 0, 1],
                    ignoreDefaultValues: true,
                    ignoreEnums: true,
                    ignoreNumericLiteralTypes: true
                }
            ],
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                    custom: {
                        regex: '^I[A-Z]',
                        match: false
                    }
                }
            ]
        },
    },
    {
        // Test file specific rules
        name: 'ts/test',
        files: ['src/**/*.spec.ts', 'src/**/__tests__/**/*.ts', 'test/**/*.ts'],
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            'no-magic-numbers': 'off',
            'max-nested-callbacks': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/unbound-method': 'off',
            'jest/expect-expect': 'error',
            'jest/no-disabled-tests': 'warn',
            'jest/no-focused-tests': 'error'
        },
    },
    {
        // gRPC specific rules
        name: 'ts/grpc',
        files: ['src/**/*.service.ts', 'src/**/*.controller.ts'],
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            'no-throw-literal': 'off', // Using typescript-eslint's version instead
            '@typescript-eslint/no-throw-literal': 'error',
            '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'as' }]
        }
    },
    {
        // Decorators have special handling
        name: 'ts/decorators',
        files: ['src/**/*.decorator.ts'],
        rules: {
            '@typescript-eslint/ban-types': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-this-alias': [
                'error',
                { allowDestructuring: true, allowedNames: ['self'] }
            ]
        }
    },
];