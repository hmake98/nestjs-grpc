import eslintConfigPrettier from 'eslint-config-prettier';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { configs as tsEslintConfigs } from 'typescript-eslint';

const baseTsRules = tsEslintConfigs.recommended
    .map(config => config.rules)
    .filter(Boolean)
    .reduce((a, b) => ({ ...a, ...b }), {});

// Custom rule overrides
const customTsRules = {
    ...baseTsRules,
    '@typescript-eslint/no-explicit-any': 'off',
    'no-unused-vars': 'off',
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
};

const baseTsConfig = {
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
        reportUnusedDisableDirectives: true,
    },
    plugins: {
        '@typescript-eslint': tsEslintPlugin,
    },
    rules: customTsRules,
};

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
        name: 'ts/src',
        files: ['src/**/*.ts'],
        ...baseTsConfig,
        linterOptions: {
            ...baseTsConfig.linterOptions,
            noInlineConfig: true,
        },
    },
    {
        name: 'ts/test',
        files: ['test/**/*.spec.ts'],
        ...baseTsConfig,
        linterOptions: {
            ...baseTsConfig.linterOptions,
            noInlineConfig: false,
        },
    },
];
